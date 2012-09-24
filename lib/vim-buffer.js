var util = require('util'),
	EventEmitter = require('events').EventEmitter;

// Represents a Vim/Netbeans buffer
function VimBuffer(client, id) {
	this.client = client;
	this.id = id;
	this.maxAnnoTypeNum = 1;
	this.maxAnnoSerNum = 1;
	this.annoTypeNums = {};
}
VimBuffer.prototype = {
	id: -1,
	pathname: null,
	docName: null,
	title: null
};
util.inherits(VimBuffer, EventEmitter);

VimBuffer.prototype.toString = function () {
	return "[VimBuffer " + this.id + "]";
};

VimBuffer.prototype._sendCommand = function (name, args) {
	this.client._sendCommand(this.id, name, args);
};

VimBuffer.prototype._sendFunction = function (name, args, cb, rawReply) {
	this.client._sendFunction(this.id, name, args, cb, rawReply);
};

VimBuffer.prototype._cleanup = function () {
	this.removeAllListeners();
	var client = this.client;
	delete client.buffers[this.id];
	if (client.buffersByPathname[this.pathname] == this) {
		delete client.buffersByPathname[this.pathname];
	}
};

VimBuffer.prototype.addAnno = function (type, offset) {
	var typeNum = this.annoTypeNums[type.id] || this.defineAnnoType(type);
	var serNum = this.maxAnnoSerNum++;
	this._sendCommand("addAnno", [serNum, typeNum, offset, 1]);
	return serNum;
};

VimBuffer.prototype.close = function () {
	this._sendCommand("close");
};

function processColor(color) {
	return typeof color == "string" ?
		color[0] == "#" ? // convert hex to number
			parseInt(color.substr(1), 16) : color :
		typeof color == "number" ?
			color : -Infinity; // color "none" sentinel;
}

VimBuffer.prototype.defineAnnoType = function (type) {
	var typeNum = this.maxAnnoTypeNum++;
	this.annoTypeNums[type.id] = typeNum;
	this._sendCommand("defineAnnoType",
		[typeNum, type.name, type.tooltip, type.glyph,
		processColor(type.fg), processColor(type.bg)]);
	return typeNum;
};

VimBuffer.prototype.editFile = function (pathname) {
	this.pathname = pathname;
	this._sendCommand("editFile", pathname);
	// do we need to listen for fileOpened?
};

VimBuffer.prototype.guard = function (offset, length) {
	this._sendCommand("guard", [offset, length]);
};

VimBuffer.prototype.initDone = function () {
	this._sendCommand("initDone");
};

VimBuffer.prototype.insertDone = function () {
	this._sendCommand("insertDone");
};

VimBuffer.prototype.netbeansBuffer = function fn(own) {
	this._sendCommand("netbeansBuffer", !!own);
};

VimBuffer.prototype.removeAnno = function (serNum) {
	this._sendCommand("removeAnno", serNum);
};

VimBuffer.prototype.save = function () {
	this._sendCommand("save");
};

VimBuffer.prototype.saveDone = function () {
	this._sendCommand("saveDone");
};

VimBuffer.prototype.setDot = function fn(offset) {
	if (fn.arguments.length == 2) {
		// lnum/col
		offset += "/" + fn.arguments[1];
	}
	this._sendCommand("setDot", offset);
};

VimBuffer.prototype.setFullName = function (pathname) {
	this.pathname = pathname;
	this._sendCommand("setFullName", pathname);
};

VimBuffer.prototype.setModified = function (isModified) {
	this._sendCommand("setModified", !!isModified);
};

VimBuffer.prototype.setModtime = function (date) {
	this._sendCommand("setModtime", Math.floor(date.getTime()/1000));
};

VimBuffer.prototype.setReadOnly = function () {
	this._sendCommand("setReadOnly");
};

VimBuffer.prototype.setTitle = function (title) {
	// when is this needed?
	this.title = title;
	this._sendCommand("setTitle", title);
};

VimBuffer.prototype.setVisible = function (isVisible) {
	this._sendCommand("setVisible", !!isVisible);
};

VimBuffer.prototype.startDocumentListen = function () {
	this._sendCommand("startDocumentListen");
};

VimBuffer.prototype.stopDocumentListen = function () {
	this._sendCommand("stopDocumentListen");
};

VimBuffer.prototype.unguard = function () {
	this._sendCommand("unguard");
};

VimBuffer.prototype.getCursor = function (cb) {
	var self = this;
	this.client.getCursor(function (buf, lnum, col, offset) {
		if (buf == self) cb(lnum, col, offset);
		else cb(null, null, null);
	});
};

VimBuffer.prototype.getLength = function (cb) {
	this._sendFunction("getLength", [], cb);
};

VimBuffer.prototype.getAnno = function (serNum, cb) {
	this._sendFunction("getAnno", serNum, cb);
};

VimBuffer.prototype.getModified = function (cb) {
	this._sendFunction("getModified", [], function (modified) {
		cb(!!modified)
	});
};

VimBuffer.prototype.getText = function (cb) {
	this._sendFunction("getText", [], cb);
};

VimBuffer.prototype.insert = function (offset, text, cb) {
	this._sendFunction("insert", [offset, String(text)], function (msg) {
		var error = null;
		if (msg && msg[0] == '!') {
			// reply is unquoted
			error = msg.substr(1);
		}
		cb && cb(error);
	}, true);
};

VimBuffer.prototype.remove = function (offset, length, cb) {
	this._sendFunction("remove", [offset, length], function (msg) {
		if (msg && msg[0] == '!') {
			// reply is unquoted
			var error = msg.substr(1);
		}
		cb && cb(error);
	}, true);
};

module.exports = VimBuffer;
