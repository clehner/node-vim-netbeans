var util = require('util'),
	net = require('net'),
	EventEmitter = require('events').EventEmitter,
	VimClient = require('./vim-client');

function VimServer(opt) {
	if (!opt) opt = {};
	this.maxBufID = 1;
	this.maxSeqno = 1;
	this.buffers = [];
	this.auth = opt.auth || opt.password;
	this.port = opt.port || 3219;

	this.server = net.createServer(this.onConnection.bind(this));
}
util.inherits(VimServer, EventEmitter);

VimServer.prototype.listen = function (/* port, hostname, cb */) {
	var arguments = Array.prototype.slice.call(arguments);
	var port = this.port, hostname, cb;
	arguments.forEach(function (arg) {
		if (typeof arg === 'function') {
			cb = arg;
		} else if (typeof arg === 'string' && isNaN(arg)) {
			hostname = arg;
		} else if (!isNaN(arg)) {
			port = arg;
		}
	});
	this.server.listen(port, hostname, cb);
};

VimServer.prototype.onConnection = function (socket) {
	var vim = new VimClient(this, socket);
	//console.log("vim client connected.");

	socket.on('end', vim.onDisconnected.bind(vim));
	socket.on('data', vim.onData.bind(vim));
};

VimServer.prototype.authClient = function (client, password) {
	var authed =
		typeof this.auth == "function" && this.auth(password, client) ||
		!this.auth || this.auth == password;
	if (authed) this.emit("clientAuthed", client);
	return authed;
}

module.exports = VimServer;
