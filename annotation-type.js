function AnnotationType(opt) {
	// In the spec, annoTypes are unique to buffers,
	// so here we keep track of our typeNum for each buffer
	this.typeNumsByBufID = {};
	this.name = opt.name || "";
	this.glyphFile = opt.glyphFile || null;
	this.fg = opt.fg || null;
	this.bg = opt.bg || null;
}

AnnotationType.prototype.getTypeNumForBuffer = function (buffer) {
	return this.typeNumsByBufID[buffer.id];
};

AnnotationType.prototype.setTypeNumForBuffer = function (buffer, num) {
	this.typeNumsByBufID[buffer.id] = num;
};

module.exports = AnnotationType;
