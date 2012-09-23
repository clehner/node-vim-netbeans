var maxID = 0;

function AnnotationType(opt) {
	this.name = opt.name || "";
	this.tooltip = opt.tooltip || "";
	this.glyph = opt.glyph || null;
	this.fg = opt.fg;
	this.bg = opt.bg;
	this.id = maxID++;
}

module.exports = AnnotationType;
