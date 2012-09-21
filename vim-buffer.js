var util = require('util'),
	EventEmitter = require('events').EventEmitter;

// Represents a Vim/Netbeans buffer
function VimBuffer(client, id) {
	this.client = client;
	this.id = id;
	this.maxAnnoTypeNum = 0;
	this.maxAnnoSerNum = 0;
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

VimBuffer.prototype.sendCommand = function (name, args) {
	this.client._sendCommand(this.id, name, args);
};

VimBuffer.prototype.sendFunction = function (name, args, cb) {
	this.client._sendFunction(this.id, name, args, cb);
};

VimBuffer.prototype.addAnno = function (type, offset) {
	var typeNum = type.getTypeNumForBuffer(this) || this.defineAnnoType(type);
	var serNum = this.maxAnnoSerNum++;
	this.sendCommand("addAnno", [serNum, typeNum, offset, 1]);
	return serNum;
	// todo: remove annotype typenum when buffer closes
};

VimBuffer.prototype.close = function () {
	this.sendCommand("close");
};

VimBuffer.prototype.defineAnnoType = function (type) {
	var typeNum = this.maxAnnoTypeNum++;
	type.setTypeNumForBuffer(this, typeNum);
	this.sendCommand("defineAnnoType",
		typeNum, type.name, "", type.glyphFile, type.fg, type.bg);
	return typeNum;
};

VimBuffer.prototype.editFile = function (pathname) {
	this.pathname = pathname;
	this.sendCommand("editFile", pathname);
	// is this event possible?
	// do we need to listen for fileOpened?
};

VimBuffer.prototype.guard = function (offset, length) {
	this.sendCommand("guard", [offset, length]);
};

VimBuffer.prototype.initDone = function () {
	this.sendCommand("initDone");
};

VimBuffer.prototype.insertDone = function () {
	this.sendCommand("insertDone");
};

VimBuffer.prototype.netbeansBuffer = function (own) {
	this.sendCommand("netbeansBuffer", (arguments.length == 0) || !!own);
};

VimBuffer.prototype.removeAnno = function () {
	this.sendCommand("removeAnno");
};

VimBuffer.prototype.save = function () {
	this.sendCommand("save");
};

VimBuffer.prototype.saveDone = function () {
	this.sendCommand("saveDone");
};

VimBuffer.prototype.setDot = function (offset) {
	if (arguments.length == 2) {
		// lnum/col
		offset += "/" + arguments[1];
	}
	this.sendCommand("setDot", offset);
};

VimBuffer.prototype.setFullName = function (pathname) {
	this.pathname = pathname;
	this.sendCommand("setFullName", pathname);
};

VimBuffer.prototype.setModified = function (isModified) {
	this.sendCommand("setModified", !!isModified);
};

VimBuffer.prototype.setModtime = function (time) {
	this.sendCommand("setModtime", time);
};

VimBuffer.prototype.setReadOnly = function () {
	this.sendCommand("setReadOnly");
};

VimBuffer.prototype.setTitle = function (title) {
	// when is this needed?
	this.title = title;
	this.sendCommand("setTitle", title);
};

VimBuffer.prototype.setVisible = function (isVisible) {
	this.sendCommand("setVisible", !!isVisible);
};

VimBuffer.prototype.startDocumentListen = function () {
	this.sendCommand("startDocumentListen");
};

VimBuffer.prototype.stopDocumentListen = function () {
	this.sendCommand("stopDocumentListen");
};

VimBuffer.prototype.unguard = function () {
	this.sendCommand("unguard");
};

VimBuffer.prototype.getLength = function (cb) {
	this.sendFunction("getLength", cb);
};

VimBuffer.prototype.getAnno = function (serNum, cb) {
	this.sendFunction("getAnno", serNum, cb);
};

VimBuffer.prototype.getModified = function (cb) {
	this.sendFunction("getModified", [], cb);
};

VimBuffer.prototype.getText = function (cb) {
	this.sendFunction("getText", [], function (quotedText) {
		cb(parseArgs(quotedText)[0]);
	});
};

VimBuffer.prototype.saveAndExit = function (cb) {
	this.sendFunction("saveAndExit", [], cb);
};

module.exports = VimBuffer;
