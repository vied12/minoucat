// -----------------------------------------------------------------------------
// Project : MILF
// -----------------------------------------------------------------------------
// Author : Edouard Richard                                  <edou4rd@gmail.com>
// -----------------------------------------------------------------------------
// License : GNU Lesser General Public License
// -----------------------------------------------------------------------------
// Creation : 06-Dec-2012
// Last mod : 06-Dec-2012
// -----------------------------------------------------------------------------

var flatiron    = require('flatiron'),
	path        = require('path'),
	plates      = require('plates'),
	fs          = require("fs"),
	app         = flatiron.app,
	io          = require('socket.io'),
	mongodb     = require('mongodb'),
	json        = require("JSON2"),
	chans       = {},
	Db          = mongodb.Db;
var mongoUri    = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/socket'; 

app.use(flatiron.plugins.http, {});
app.use(flatiron.plugins.static, {root: __dirname});
app.config.file({ file: path.join(__dirname, 'config', 'config.json') });

// -----------------------------------------------------------------------------
// MONGODB
// -----------------------------------------------------------------------------
var collectionTalk = null;
Db.connect(mongoUri, function (err, db) {
	db.collection('talk', function(err, collection) {
		collectionTalk = collection;
	});
});
// -----------------------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------------------
function render(_app, page, content, map) {
	fs.readFile(__dirname + page,'utf-8', function (err, html) {
		html = plates.bind(html,content, map);
		_app.res.writeHead(200,{'Content-Type': 'text/html;charset=utf-8'});
		_app.res.end(html,'utf-8');
	});
}

function getConversations() {
	collectionTalk.distinct('conversation', function(err, conversations) {
		return conversations;
	});
}

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------
app.router.get('/', function () {
	var self = this;
	collectionTalk.distinct('conversation', function(err, conversations) {
		var data = {
			'chans' : chans,
			'logs'  : conversations
		};
		var content = {'data': escape(JSON.stringify(data))};
		var map     = plates.Map();
		map.where('class').is('Navigation').use('data').as('data-data');
		render(self, '/index.html', content, map);
	});
});

app.router.get('/chan/:chan', function (chan) {
	content = {chan: chan};
	var map = plates.Map();
	map.where('class').is('Chan').use('chan').as('data-chan');
	render(this, '/chan.html', content, map);
});

app.router.get('/log/:id', function (id) {
	var self = this;
	collectionTalk.find({"conversation":parseInt(id)}).sort({'date':1}).toArray(function(err, results) {
		// find next and previous conversation
		var next=null, previous=null;
		collectionTalk.distinct('conversation', function(err, conversations) {
			var current = conversations.indexOf(parseInt(id));
			if (current > -1) {
				if (conversations.length > current + 1)
					next = conversations[current+1].toString();
				if (current > 0)
					previous = conversations[current-1].toString(); 
			}
			data = {
				quotes   : results,
				next     : next,
				previous : previous
			}
			var content = {logs: escape(JSON.stringify(data))};
			var map = plates.Map();
			// NOTE: Fucking bullshit, it doesn't work.
			// if (previous != null)
			// 	map.where('id').is('previous').use('previous').as('href');
			// if (next != null)
			// 	map.where('id').is('next').use('next').as('href');
			map.where('class').is('Log').use('logs').as('data-log');
			render(self, '/log.html', content, map);
		});
	});
});

// -----------------------------------------------------------------------------
// APPLICATION
// -----------------------------------------------------------------------------
var users = [];
var port = process.env.PORT || 5000;
app.start(port, function () {
	console.log('Application is now started on port 3000');
	// -------------------------------------------------------------------------
	// SOCKET.IO
	// -------------------------------------------------------------------------
	io = io.listen(app.server);
	io.configure(function () { 
		io.set("transports", ["xhr-polling"]);
		io.set("polling duration", 10);
	});
	io.sockets.on('connection', function(socket) {
		socket.on('join_chan', function(data) {
			var chan = data.name;
			socket.join(chan);
			// registrer the chan if doesn't exist
			if (chans[chan] == undefined) {
				chans[chan] = {recording:false, conversation:null, last_message:null};
			}
			// get and send to other users the users list
			users[""+socket.id] = data.user;
			var users_in_chan   = [];
			var socket_in_chan  = io.sockets.clients(chan);
			for (i=0; i<socket_in_chan.length; i++) {
				users_in_chan.push(users[""+socket_in_chan[i].id]);
			}
			io.sockets.in(chan).emit('new_user', {"new_user":data, "all_users":users_in_chan});
			// on new message
			socket.on('new_message', function(data) {
			// disable record mode if last message > 5min
			if (chans[chan].recording){
				var diff = new Date().getTime() - chans[chan].last_message.getTime();
				diff     = (diff/1000)/60; // minutes
				if (diff > 5) {
					// end of conversation
					chans[chan].recording = false;
				}
			}
			// switch to record mode if msg > 4 words
			if (!chans[chan].recording && data.message.split(" ").length > 4) {
				chans[chan].recording    = true;
				chans[chan].conversation = new Date().getTime();
			}
			// record message
			if (chans[chan].recording) {
				data['date']             = new Date();
				data['chan']             = chan;
				data['conversation']     = chans[chan].conversation;
				chans[chan].last_message = data['date'];
				collectionTalk.insert(data);
			}
				// broadcast message
				io.sockets.in(chan).emit('new_message', data);
			});
		});
	});
});