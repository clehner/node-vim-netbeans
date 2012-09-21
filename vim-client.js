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
		// add extra space at the end to allow tokens to close
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
					args.push(str.substring(tokStart, i-1));
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
					state = inStringState;
				}
			break;

			case inNumberState:
				if (char == ' ') {
					args.push(Number(str.substring(tokStart, i)));
					state = betweenArgsState;
				} else if ((char < '0' || char > '9') && char != '.') {
					// this shouldn't happen
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
				// otherwise ignore it!
			break;
		}
	}

	//console.log('parsing args', str, args);
	return args;
}

var backslashRe = /\\/g,
	newlineRe = /\n/g,
	cReturnRe = /\r/g,
	tabRe = /\t/g,
	doubleQuoteRe = /"/g,
	nullRe = /"/g;

// quote strings for sending over the wire
function quoteArg(item) {
	if (typeof item == "number") return item.toString();
	if (typeof item == "boolean") return item ? "T" : "F";
	if (item === null) return "none"; // for colors
	if (!item) return '""';
	return '"' + (item.toString().
		replace(backslashRe, '\\\\').
		replace(newlineRe, '\\n').
		replace(cReturnRe, '\\r').
		replace(tabRe, '\\t').
		replace(nullRe, '').
		replace(doubleQuoteRe, '\\"')) + '"';
}

function argsToString(args) {
	return typeof args != "undefined" ? " " +
		(Object.prototype.toString.call(args) == "[object Array]" ?
			args.map(quoteArg).join(" ") : quoteArg(args)) : "";
}

function VimClient(server, socket) {
	this.server = server;
	this.socket = socket;
	this.replyHandlers = {};
	this.keyHandlers = {};
	this.buffersByPathname = {};
	this.buffers = [];
	this.maxBufID = 1;
	this.maxSeqno = 1;
}
util.inherits(VimClient, EventEmitter);

VimClient.prototype.onDisconnected = function () {
	this.emit("disconnected");
}

VimClient.prototype.onData = function (data) {
	var str = data.toString('utf8');
	var messages = str.trim().split("\n");
	messages.forEach(this.onMessage.bind(this));
};

var eventRe = /^([0-9]+):([a-zA-Z]+)=([0-9]+)(?: (.*))?$/,
	replyRe = /^([0-9]+)(?: (.*))?$/;

VimClient.prototype.onMessage = function (message) {
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
		if (this.server.authClient(this, pass)) {
			console.log("vim client logged in");
			this.authed = true;
		} else {
			console.log("vim client gave invalid password");
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
	console.log('sending command', bufID + ":" + name + "!" + seqno + body);
};

VimClient.prototype.sendCommand = function (name, args) {
	this._sendCommand("0", name, args);
};

VimClient.prototype._sendFunction = function (bufID, name, args, cb) {
	var seqno = this.maxSeqno++;
	var body = argsToString(args);
	this.socket.write(bufID + ":" + name + "/" + seqno + body + "\n");
	this.replyHandlers[seqno] = cb;
};

VimClient.prototype.sendFunction = function (name, args, cb) {
	this._sendFunction("0", args, cb);
};

VimClient.prototype._processReply = function (seqno, body) {
	var cb = this.replyHandlers[seqno];
	if (typeof cb == "function") {
		delete this.replyHandlers[seqno];
		cb(body);
	} else {
		console.log("got reply for unknown seqno " + seqno + ": " + body);
	}
};

VimClient.prototype._processEvent = function (bufID, name, seqno, body) {
	// seqno doesn't really matter for events.
	var args = [name];
	var buffer = this.buffers[bufID];
	if (buffer) args.push(buffer);
	if (body) parseArgs(body, args);
	var builtin = eventHandlers[name];
	if (builtin) builtin.apply(this, (buffer ? [] : [buffer])
		.concat(args.slice(1)));
	//console.log(args);
	// do we really need to emit it in both places?
	if (buffer) buffer.emit.apply(buffer, args);
	this.emit.apply(this, args);
};

// register a key handler
VimClient.prototype.key = function (key, handler) {
	this.keyHandlers[key] = handler;
	this.specialKeys(key);
};

// Built-in event handlers
var eventHandlers = {
	fileOpened: function (buffer, pathname) {
		if (buffer) return;
		// assign an id to this new buffer, and keep track of it
		var bufID = this.maxBufID++;
		buffer = this.buffers[bufID] = new VimBuffer(this, bufID);
		if (!pathname) pathname = "";
		buffer.pathname = pathname;
		console.log("assign buffer id " + bufID + " to " + pathname);
		this.putBuffer(buffer, pathname);
		this.emit("newBuffer", buffer);
	},

	keyAtPos: function (buffer, keyName, offset, lnumCol) {
		console.log("key command " + keyName + " pressed");
		var fn = this.keyHandlers[keyName];
		if (typeof fn == "function") {
			if (lnumCol == null) {
				lnumCol = offset;
				offset = null;
			}
			var coords = lnumCol.split("/");
			fn(buffer, offset, coords[0], coords[1]);
		}
	},

	killed: function (buffer) {
		delete this.buffers[buffer.id];
	}
};

// NetBeans Commands
VimClient.prototype.create = function () {
	// create a buffer
	var bufID = this.maxBufID++;
	var buffer = this.buffers[bufID] = new VimBuffer(this, bufID);
	buffer.sendCommand("create");
	// emit newBuffer?
	return buffer;
};

VimClient.prototype.editFile = function (pathname, cb) {
	var bufID = this.maxBufID++;
	var buffer = buffers[bufID] = new VimBuffer(this, bufID);
	buffer.pathname = pathname;
	var bufs = this.buffersByPathname;
	bufs[pathname] = buffer;
	this._sendCommand(bufID, "editFile", pathname);
	this.once("fileOpened", function (pathname) {
		bufs[pathname] = buffer;
		buffer.pathname = pathname;
		cb && cb(buffer);
	});
	// emit newBuffer?
};

VimClient.prototype.putBuffer = function (buffer, pathname) {
	this._sendCommand(buffer.id, "putBufferNumber", pathname);
};

VimClient.prototype.raise = function () {
	this.sendCommand("raise");
};

VimClient.prototype.setBuffer = function (buffer, pathname) {
	this._sendCommand(buffer.id, "setBufferNumber", pathname);
};

VimClient.prototype.setExitDelay = function (secs) {
	this.sendCommand("setExitDelay", secs);
};

VimClient.prototype.showBalloon = function (text) {
	this.sendCommand("showBalloon", text);
};

VimClient.prototype.specialKeys = function (keys) {
	this.sendCommand("specialKeys", keys.join ? keys.join(" ") : keys);
};

VimClient.prototype.getCursor = function (cb) {
	this.sendFunction("getCursor", [], function (bufID, lnum, col, off) {
		cb(this.buffers[bufID], lnum, col, off);
	});
};

VimClient.prototype.getModified = function (cb) {
	this.sendFunction("getModified", [], cb);
};

VimClient.prototype.insert = function (offset, text, cb) {
	this.sendFunction("insert", [offset, text], function (msg) {
		if (msg && msg[0] == '!') {
			// reply is unquoted
			var error = msg.substr(1);
		}
		cb(error);
	});
};

VimClient.prototype.remove = function (offset, text) {
	this.sendFunction("remove", [offset, text], function (msg) {
		if (msg && msg[0] == '!') {
			// reply is unquoted
			var error = msg.substr(1);
		}
		cb(error);
	});
};

module.exports = VimClient;
