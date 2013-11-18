var util = require('util'),
	net = require('net'),
	EventEmitter = require('events').EventEmitter,
	VimClient = require('./vim-client');

function VimServer(opt) {
	this.debug = opt && !!opt.debug;
	this.clients = [];
	this.server = net.createServer(this._onConnection.bind(this));
}
util.inherits(VimServer, EventEmitter);

VimServer.defaultPassword = 'changeme';
VimServer.defaultPort = 3219;

VimServer.prototype.listen = function listen(port/*, host, backlog, callback*/) {
	var args = Array.prototype.slice.call(listen.arguments);
	if (isNaN(port)) {
		args.unshift(VimServer.defaultPort);
	}
	this.server.listen.apply(this.server, args);
};

VimServer.prototype.handleHTTP = function (server) {
	this.httpServer = server;
};

VimServer.prototype._onConnection = function (socket) {
	new VimClient(this, socket);
};

VimServer.prototype._cleanupClient = function (client) {
	var i = this.clients.indexOf(client);
	if (i != -1) {
		this.clients.splice(i, 1);
	}
};

VimServer.prototype._authClient = function (client, password) {
	this.clients.push(client);
	this.emit("clientAuthed", client, password);
};

module.exports = VimServer;
