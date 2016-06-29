console.log('Start server');

var express = require('express'), app = express(app), server = require('http').createServer(app);
// serve static files from the current directory
app.use(express.static(__dirname));

var EurecaServer = require('eureca.io').EurecaServer;
//create an instance of EurecaServer
var eurecaServer = new EurecaServer({allow:['setId', 'setOpenedServerCount', 'openTile', 'closeTile', 'setSeed', 'setMarker', 'connect', 'disconnect' ]});
var clients = {};

var seed = 0;
var map = [[],[],[],[],[],[]];
var openedCount = 0;

for (var i = 0; i < 6; i++)
	for (var j = 0; j < 6; j++)
		map[i][j] = -1;

function logMap()
{
	for (var i = 0; i < 6; i++)
	{
		var s = "";
		for (var j = 0; j < 6; j++)
			{
				s += map[i][j] + "|";
			}
		console.log(s);
	}
}

//attach eureca.io to our http server
eurecaServer.attach(server);
//detect client connection
eurecaServer.onConnect(function (conn) {
    console.log('New Client id=%s ', conn.id, conn.remoteAddress);
		for(var c in clients)
		{
					clients[c].remote.connect(conn.id);
		}

    var remote = eurecaServer.getClient(conn.id);
    clients[conn.id] = {id:conn.id, remote:remote};
	
	console.log("seed");
	
	remote.setSeed(seed);
    remote.setId(conn.id);
	
	console.log("map load");
	
	for (var i = 0; i < 6; i++)
	{
		for (var j = 0; j < 6; j++)
			if(map[i][j] != -1)
			{
				remote.openTile(map[i][j], i * 100, j * 100);
			}
	}
});
//detect client disconnection
eurecaServer.onDisconnect(function (conn) {
    console.log('Client disconnected ', conn.id);

    var removeId = clients[conn.id].id;
    delete clients[conn.id];

    for(var c in clients)
    {
          clients[c].remote.disconnect(conn.id);
    }

});

eurecaServer.exports.openTile = function(id, ind, x, y)
{
	//if (map[x / 100][y / 100] != -1) return;
	openedCount++;
	
	console.log(ind + " " + x / 100 + " " + y / 100);
	map[x / 100][y / 100] = ind;

	for(var c in clients)
	{
			if (c == id) continue;
			clients[c].remote.openTile(ind, x, y);
	}
		
		
	for (var i = 0; i < 6; i++)
	{
		for (var j = 0; j < 6; j++)
		{
			if(map[i][j] != -1)
			{
				clients[c].remote.openTile(map[i][j], i * 100, j * 100);
			}
		}
	}
}

eurecaServer.exports.closeTile = function(id, x, y)
{
	//if (map[x / 100][y / 100] == -1) return; // ???
	openedCount--;
	console.log("close " + x + " " + y);
	//map[x / 100][y / 100] = -1;
	map[x][y] = -1;
	for(var c in clients)
	{
			if (c == id) continue;
			clients[c].remote.closeTile(x, y);
	}
		
		
	for (var i = 0; i < 6; i++)
	{
		for (var j = 0; j < 6; j++)
			if(map[i][j] == -1)
			{
				clients[c].remote.closeTile(i, j);
			}
	}
}

eurecaServer.exports.loadMap = function(id)
{
	for(var i = 0; i < 6; i++)
		for(var j = 0; j < 6; j++)
		{
			if (map[i][j] != -1)
			{
				clients[id].remote.openTile(map[i][j], i * 100, j * 100);
			}
			else
			{
				clients[id].remote.closeTile(i, j);
			}
		}
}

eurecaServer.exports.getClients = function(id)
{
		for(var c in clients)
		{
				clients[id].remote.connect(c);
		}
}

eurecaServer.exports.setMarker = function(id, x, y)
{
		for(var c in clients)
		{
				if(id != c)
				{ clients[c].remote.setMarker(id, x, y);}
		}
}

eurecaServer.exports.getOpenedCount = function(id)
{
	clients[id].remote.setOpenedServerCount(openedCount);
}


server.listen(8055);
