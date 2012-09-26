var util = require('util'),
	net = require('net'),
	EventEmitter = require('events').EventEmitter,
	VimClient = require('./vim-client');

function VimServer(opt) {
	if (!opt) opt = {};
	this.port = opt.port || 3219;
	this.debug = !!opt.debug;
	this.auth = typeof opt.auth == "function" ? opt.auth :
		opt.password ? function (pass) { return pass == opt.password; } :
		function () { return true; };

	this.server = net.createServer(this._onConnection.bind(this));
}
util.inherits(VimServer, EventEmitter);

VimServer.prototype.listen = function listen(/* port, hostname, cb */) {
	var arguments = Array.prototype.slice.call(listen.arguments);
	var port = this.port, hostname, cb;
	listen.arguments.forEach(function (arg) {
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

VimServer.prototype._onConnection = function (socket) {
	var vim = new VimClient(this, socket);
	//console.log("vim client connected.");

	socket.on('end', vim._onDisconnected.bind(vim));
	socket.on('data', vim._onData.bind(vim));
	socket.on('error', vim._onError.bind(vim));
};

VimServer.prototype._authClient = function (client, password) {
	var authed = !!this.auth(password, client);
	if (authed) this.emit("clientAuthed", client);
	return authed;
}

module.exports = VimServer;
