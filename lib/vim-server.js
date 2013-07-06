var util = require('util'),
	net = require('net'),
	EventEmitter = require('events').EventEmitter,
	VimClient = require('./vim-client'),
	defaultPort = 3219;

function VimServer(opt) {
	if (!opt) opt = {};
	this.debug = !!opt.debug;
	this.auth = typeof opt.auth == "function" ? opt.auth :
		opt.password ? function (pass) { return pass == opt.password; } :
		function () { return true; };

	this.server = net.createServer(this._onConnection.bind(this));
}
util.inherits(VimServer, EventEmitter);

VimServer.prototype.listen = function listen(port/*, host, backlog, callback*/) {
	var args = Array.prototype.slice.call(listen.arguments);
	if (isNaN(port)) {
		args.unshift(defaultPort);
	}
	this.server.listen.apply(this.server, args);
};

VimServer.prototype._onConnection = function (socket) {
	new VimClient(this, socket);
};

VimServer.prototype._authClient = function (client, password) {
	var authed = !!this.auth(password, client);
	if (authed) this.emit("clientAuthed", client);
	return authed;
}

module.exports = VimServer;
