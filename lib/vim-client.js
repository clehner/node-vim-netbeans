var util = require('util'),
	EventEmitter = require('events').EventEmitter,
	VimBuffer = require('./vim-buffer');

// stuff for parsing args
var betweenArgsState = 0,
	inUnquotedStringState = 1,
	inStringState = 2,
	gotBackslashInStringState = 3,
	inNumberState = 4,
	gotBoolState = 5,
	gotEndQuoteState = 6;

// parse a received message into an array
function parseArgs(str, args) {
	var tokStart = 0,
		tokStr = "",
		tokBool,
		state = betweenArgsState;
	if (!args) args = [];

	for (var i = 0; i <= str.length; i++) {
		// use space for eof
		var char = str[i] || ' ';

		switch(state) {
			case betweenArgsState:
				tokStart = i - 1;
				switch(char) {
					case ' ':
						break;
					case '"':
						state = inStringState;
						break;
					case 'T':
						tokBool = true;
						state = gotBoolState;
						break;
					case 'F':
						tokBool = false;
						state = gotBoolState;
						break;
					default:
						if (char >= '0' || char <= '9') {
							state = inNumberState;
						} else {
							state = inUnquotedStringState;
						}
					break;
				}
			break;

			case inUnquotedStringState:
				if (char == ' ') {
					state = betweenArgsState;
					args.push(str.substring(tokStart, i));
				}
			break;

			case inStringState:
				switch(char) {
					case '\\':
						state = gotBackslashInStringState;
						break;
					case '"':
						state = gotEndQuoteState;
						args.push(tokStr);
						tokStr = "";
						break;
					default:
						tokStr += char;
					break;
				}
			break;

			case gotBackslashInStringState:
				switch(char) {
					case '"':
						tokStr += '"';
						break;
					case 'n':
						tokStr += '\n';
						break;
					case 'r':
						tokStr += '\r';
						break;
					case 't':
						tokStr += '\t';
						break;
					case '\\':
						tokStr += '\\';
						break;
					default:
						tokStr += '\\' + char;
					break;
				}
				state = inStringState;
			break;

			case inNumberState:
				if (char == ' ') {
					args.push(Number(str.substring(tokStart, i)));
					state = betweenArgsState;
				} else if ((char < '0' || char > '9') &&
					char != '.' &&
					char != '-') {
					// not a number after all
					state = inUnquotedStringState;
				}
			break;

			case gotBoolState:
				if (char == ' ') {
					args.push(tokBool);
					state = betweenArgsState;
				} else {
					// could be a color, maybe
					state = inUnquotedStringState;
				}
			break;

			case gotEndQuoteState:
				if (char == ' ') {
					state = betweenArgsState;
				}
				// otherwise ignore it
			break;
		}
		//console.log(state, char);
	}

	//console.log(str);
	return args;
}

var backslashRe = /\\/g,
	newlineRe = /\n/g,
	cReturnRe = /\r/g,
	tabRe = /\t/g,
	doubleQuoteRe = /"/g,
	nullRe = /\0/g;

// quote strings for sending over the wire
function quoteArg(item) {
	if (item == -Infinity) return "none"; // color sentinel
	if (typeof item == "number") return item.toString();
	if (typeof item == "boolean") return item ? "T" : "F";
	if (!item) return '""';
	return '"' + (item.toString().
		replace(backslashRe, '\\\\').
		replace(newlineRe, '\\n').
		replace(cReturnRe, '\\r').
		replace(tabRe, '\\t').
		replace(nullRe, '').
		replace(doubleQuoteRe, '\\"')) + '"';
}

function isArray(arr) {
	return Object.prototype.toString.call(arr) == "[object Array]";
}

function argsToString(args) {
	return typeof args != "undefined" ? " " +
		(isArray(args) ?  args.map(quoteArg).join(" ") : quoteArg(args)) : "";
}

function VimClient(server, socket) {
	this.server = server;
	this.socket = socket;
	this.replyHandlers = {};
	this.keyHandlers = {};
	this.buffers = [];
	this.buffersByPathname = {};
	this.maxBufID = 1;
	this.maxSeqno = 1;
	this.debug = server.debug;
	this.partialMessages = [];
}
util.inherits(VimClient, EventEmitter);

function failSend() {
	throw new Error("Cannot send message to disconnected client.");
};

VimClient.prototype._onDisconnected = function () {
	this.emit("disconnected");
	this._cleanup();
	this._sendCommand = failSend;
	this._sendFunction = failSend;
}

VimClient.prototype._onData = function (data) {
	var str = data.toString('utf8');
	var messages = str.split("\n");
	if (messages.length == 0) return;
	if (str[str.length-1] != "\n") {
		// got a partial message
		this.partialMessages.push(messages.pop());
	} else if (this.partialMessages.length) {
		// got the completion of partial messages (hopefully)
		var partials = this.partialMessages.concat(messages.shift());
		messages.unshift(partials.join("").split("\n"));
		this.partialMessages.length = 0;
	}
	messages.forEach(this._onMessage.bind(this));
};

VimClient.prototype._onError = function (error) {
	console.log("Client's socket had an error: " + error);
	this.socket.destroy();
	this._cleanup();
};

var eventRe = /^([0-9]+):([a-zA-Z]+)=([0-9]+)(?: (.*))?$/,
	replyRe = /^([0-9]+)(?: (.*))?$/;

VimClient.prototype._onMessage = function (message) {
	if (!message) return;
	if (this.debug) console.log("got message", message);
	// Must be authed before considering events
	if (this.authed) {
		var e = eventRe.exec(message);
		if (e) {
			this._processEvent(e[1], e[2], e[3], e[4]);
		} else {
			e = replyRe.exec(message);
			if (e) {
				this._processReply(e[1], e[2]);
			} else {
				console.log("unable to parse message", message);
			}
		}

	// Handle the special AUTH message
	} else if (message.substr(0, 5) == 'AUTH ') {
		// password is unquoted
		var pass = message.substr(5);
		//this.emit("auth", pass);
		if (this.server._authClient(this, pass)) {
			this.authed = true;
		} else {
			this.socket.end();
		}
	} else {
		console.log("message from unauthed client discarded", message);
	}
};

VimClient.prototype._sendCommand = function (bufID, name, args) {
	var seqno = this.maxSeqno++;
	var body = argsToString(args);
	this.socket.write((bufID || "0") + ":" + name + "!" + seqno + body + "\n");
	if (this.debug)
		console.log('sending command', bufID, name, body.substr(1));
};

VimClient.prototype._sendFunction = function (bufID, name, args, cb, rawReply) {
	var seqno = this.maxSeqno++;
	var body = argsToString(args);
	this.socket.write(bufID + ":" + name + "/" + seqno + body + "\n");
	this.replyHandlers[seqno] = cb;
	if (cb) cb._raw = rawReply;
	if (this.debug)
		console.log('sending function', bufID, name, body.substr(1));
};

VimClient.prototype._processReply = function (seqno, body) {
	var cb = this.replyHandlers[seqno];
	if (typeof cb == "function") {
		delete this.replyHandlers[seqno];
		if (cb._raw) cb(body);
		else cb.apply(this, parseArgs(body));
	} else {
		console.log("got reply for unknown seqno " + seqno + ": " + body);
	}
};

VimClient.prototype._processEvent = function (bufID, name, seqno, body) {
	// seqno doesn't really matter for events.
	var buffer = this.buffers[bufID];
	var args = [name, buffer];
	if (body) parseArgs(body, args);
	var builtin = eventHandlers[name];
	// builtin gets passed the buffer even if it is null
	if (builtin) builtin.apply(this, args.slice(1));
	// do we really need to emit it in both places?
	if (!buffer) {
		args.splice(1, 1);
		//console.log(args);
	}
	this.emit.apply(this, args);
	if (buffer) {
		args.splice(1, 1);
		//console.log(args);
		buffer.emit.apply(buffer, args);
	}
};

VimClient.prototype._cleanup = function () {
	this.buffers.forEach(function (buffer) {
		buffer._cleanup();
	});
	this.removeAllListeners();
};

// This quits vim!
// Only use if there are no modified buffers.
// Prefer saveAndExit.
VimClient.prototype.disconnect = function () {
	this.socket.end("DISCONNECT\n");
	this._cleanup();
};

// close connection without exiting vim
VimClient.prototype.detach = function () {
	this.socket.end("DETACH\n");
	this._cleanup();
};

// register a key handler
VimClient.prototype.key = function (key, handler) {
	// don't register duplicates
	if (!(key in this.keyHandlers)) {
		this._specialKeys(key);
	}
	this.keyHandlers[key] = handler;
};

// Built-in event handlers
var eventHandlers = {
	fileOpened: function (buffer, pathname) {
		if (buffer) return;

		buffer = this.buffersByPathname[pathname];
		if (buffer) {
			// buffer probably reopened
			buffer.emit("fileOpened", pathname);
			return;
		}

		if (pathname == "") {
			// vim gives an error if we putBufferNumber these
			return;
		}

		// assign an id to this new buffer, and keep track of it
		var bufID = this.maxBufID++;
		buffer = this.buffers[bufID] = new VimBuffer(this, bufID);
		this.buffersByPathname[pathname] = buffer;
		buffer.pathname = pathname;
		//console.log("assign buffer id " + buffer.id + " to " + buffer.pathname);
		// It simplifies things to assign the buffer number here,
		// but we don't want to listen for document events yet.
		this._putBuffer(buffer, pathname);
		buffer.stopDocumentListen();
		this.emit("newBuffer", buffer);
	},

	keyAtPos: function (buffer, keyName, offset, lnumCol) {
		//console.log("key command " + keyName + " pressed");
		var fn = this.keyHandlers[keyName];
		if (typeof fn == "function") {
			if (lnumCol == null) {
				fn(buffer, offset);
			} else {
				//console.log(lnumCol, typeof lnumCol);
				var coords = lnumCol.split("/");
				fn(buffer, offset, coords[0], coords[1]);
			}
		}
	},

	killed: function (buffer) {
		buffer._cleanup();
	}
};

// NetBeans Commands
VimClient.prototype.createBuffer = function () {
	// create a buffer
	var bufID = this.maxBufID++;
	var buffer = this.buffers[bufID] = new VimBuffer(this, bufID);
	buffer._sendCommand("create");
	// emit newBuffer?
	return buffer;
};

VimClient.prototype.editFile = function (pathname, cb) {
	var bufID = this.maxBufID++;
	var buffer = buffers[bufID] = new VimBuffer(this, bufID);
	buffer.editFile(pathname);
	this.once("fileOpened", function (pathname) {
		buffer.pathname = pathname; // todo: test if this is needed
		cb && cb(buffer);
	});
	// emit newBuffer?
};

VimClient.prototype._putBuffer = function (buffer, pathname) {
	this._sendCommand(buffer.id, "putBufferNumber", pathname);
};

VimClient.prototype.raise = function () {
	this._sendCommand(0, "raise");
};

VimClient.prototype.showBalloon = function (text) {
	this._sendCommand(0, "showBalloon", text);
};

VimClient.prototype._specialKeys = function (keys) {
	this._sendCommand(0, "specialKeys", keys);
};

VimClient.prototype.getCursor = function (cb) {
	var bufs = this.buffers;
	this._sendFunction(0, "getCursor", [], function (bufID, lnum, col, off) {
		cb(bufs[bufID], lnum, col, off);
	});
};

VimClient.prototype.getModified = function (cb) {
	this._sendFunction(0, "getModified", [], cb);
};

VimClient.prototype.saveAndExit = function (cb) {
	this._sendFunction(0, "saveAndExit", [], cb);
};

VimClient.parseArgs = parseArgs;
module.exports = VimClient;
