var nb = require("./");

var server = new nb.VimServer({
	debug: false
});
server.on("clientAuthed", function (vim) {
	vim.on("newBuffer", function (buffer) {
		buffer.startDocumentListen();
		buffer.setDot(0);
		console.log("Inserting welcome message.");
		buffer.insert(0, "Press control-i to insert a timestamp.\n\n");
	});

	vim.on("insert", function (buffer, offset, text) {
		console.log("Inserted text at " + offset + ": " + text);
	});

	vim.on("remove", function (buffer, offset, length) {
		console.log("Removed " + length + " bytes at " + offset);
	});

	vim.key("C-i", function (buffer, offset, lnum, col) {
		// insert a timestamp before the current line
		console.log("Inserting timestamp");
		var num = new Date().toString();
		buffer.insert(offset - col, num);
	});

});
server.listen(function () {
	console.log("Server started. Connect with vim -nb or :nbs");
});

