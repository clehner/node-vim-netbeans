var maxID = 1;

var maxID = 0;

function AnnotationType(opt) {
	this.name = opt.name || "";
	this.glyphFile = opt.glyphFile || null;
	this.fg = opt.fg || null;
	this.bg = opt.bg || null;
	this.id = maxID++;
}

module.exports = AnnotationType;
