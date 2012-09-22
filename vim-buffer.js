var util = require('util'),
	EventEmitter = require('events').EventEmitter;

// Represents a Vim/Netbeans buffer
function VimBuffer(client, id) {
	this.client = client;
	this.id = id;
	this.maxAnnoTypeNum = 0;
	this.maxAnnoSerNum = 0;
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

VimBuffer.prototype._sendFunction = function (name, args, cb) {
	this.client._sendFunction(this.id, name, args, cb);
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

VimBuffer.prototype.defineAnnoType = function (type) {
	var typeNum = this.maxAnnoTypeNum++;
	this.annoTypeNums[type.id] = typeNum;
	this._sendCommand("defineAnnoType",
		typeNum, type.name, "", type.glyphFile, type.fg, type.bg);
	return typeNum;
};

VimBuffer.prototype.editFile = function (pathname) {
	this.pathname = pathname;
	this._sendCommand("editFile", pathname);
	// is this event possible?
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

VimBuffer.prototype.netbeansBuffer = function (own) {
	this._sendCommand("netbeansBuffer", (arguments.length == 0) || !!own);
};

VimBuffer.prototype.removeAnno = function () {
	this._sendCommand("removeAnno");
};

VimBuffer.prototype.save = function () {
	this._sendCommand("save");
};

VimBuffer.prototype.saveDone = function () {
	this._sendCommand("saveDone");
};

VimBuffer.prototype.setDot = function (offset) {
	if (arguments.length == 2) {
		// lnum/col
		offset += "/" + arguments[1];
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

VimBuffer.prototype.setModtime = function (time) {
	this._sendCommand("setModtime", time);
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

VimBuffer.prototype.getLength = function (cb) {
	this._sendFunction("getLength", cb);
};

VimBuffer.prototype.getAnno = function (serNum, cb) {
	this._sendFunction("getAnno", serNum, cb);
};

VimBuffer.prototype.getModified = function (cb) {
	this._sendFunction("getModified", [], cb);
};

VimBuffer.prototype.getText = function (cb) {
	this._sendFunction("getText", [], function (quotedText) {
		cb(parseArgs(quotedText)[0]);
	});
};

VimBuffer.prototype.insert = function (offset, text, cb) {
	this._sendFunction("insert", [offset, text], function (msg) {
		if (msg && msg[0] == '!') {
			// reply is unquoted
			var error = msg.substr(1);
		}
		cb(error);
	});
};

VimBuffer.prototype.remove = function (offset, text) {
	this._sendFunction("remove", [offset, text], function (msg) {
		if (msg && msg[0] == '!') {
			// reply is unquoted
			var error = msg.substr(1);
		}
		cb(error);
	});
};

module.exports = VimBuffer;
