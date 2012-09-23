var maxID = 0;

function AnnotationType(opt) {
	this.name = opt.name || "";
	this.glyph = opt.glyph || null;
	this.fg = opt.fg;
	this.bg = opt.fg;
	this.id = maxID++;
}

module.exports = AnnotationType;
