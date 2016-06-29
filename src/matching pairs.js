var ready = false;
var eurecaServer;
var myId;


var timeout = 15;


var loadFreq = 2; // each loadFreq time

var plmarkers = [];
var markersLen = 0;

var seed = -1;
var generated = false;

var clients = [];
var clLen = 0;

var clToRem = [];
var allowRender = false;
var openedServerCount = 0;

var openmap = [[],[],[],[],[],[]];
var changed = new Array();

for(var i = 0; i < 6; i++)
    for(var j = 0; j < 6; j++)
        openmap[i][j] = -1;

var eurecaClientSetup = function() {
	//create an instance of eureca.io client
	var eurecaClient = new Eureca.Client();

	eurecaClient.ready(function (proxy) {
		eurecaServer = proxy;
	});


	//methods defined under "exports" namespace become available in the server side

	eurecaClient.exports.setId = function(id)
	{
		//create() is moved here to make sure nothing is created before uniq id assignation
		myId = id;

		create();
		ready = true;
	}

  eurecaClient.exports.openTile = function(tileind, x, y)
  {
      if (openmap[x/100][y/100] != -1) return;
      openmap[x/100][y/100] = tileind;
      changed.push({x:x/100, y:y/100});
  }

  eurecaClient.exports.closeTile = function(x, y)
  {
      if (openmap[x][y] == -1) return;
      openmap[x][y] = -1;
      changed.push({x:x, y:y});
  }
  
  eurecaClient.exports.setOpenedServerCount = function(i)
  {
      openedServerCount = i;
  }

  eurecaClient.exports.setSeed = function(s)
  {
      seed = s;
      generated = false;
  }

	eurecaClient.exports.setMarker = function(id, x, y)
	{
			plmarkers.push([id, x, y]);
			markersLen++;
	}

	eurecaClient.exports.connect = function(id)
	{
			clients.push(id);
			clLen++;
	}

	eurecaClient.exports.disconnect = function(id)
	{
			clToRem.push(id);
	}

}

var game = new Phaser.Game(800, 600, Phaser.CANVAS, 'phaser-example', { preload: preload, create: eurecaClientSetup, update: update, render: render });

function preload() {
    game.load.tilemap('matching', 'assets/tilemaps/maps/phaser_tiles.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.image('tiles', 'assets/tilemaps/tiles/phaser_tiles.png');//, 100, 100, -1, 1, 1);
}

var timeCheck = 0;
var flipFlag = false;

var startList = new Array();
var squareList = new Array();

var masterCounter = 0;
var squareCounter = 0;
var square1Num;
var square2Num;
var savedSquareX1;
var savedSquareY1;
var savedSquareX2;
var savedSquareY2;

var map;
var tileset;
var layer;

var marker;
var currentTile;
var currentTilePosition;

var tileBack = 25;
var timesUp = '+';
var youWin = '+';

var myCountdownSeconds;
var markersGrpaphics = {};

function create() {
    map = game.add.tilemap('matching');

    map.addTilesetImage('Desert', 'tiles');

    //tileset = game.add.tileset('tiles');

    layer = map.createLayer('Ground');//.tilemapLayer(0, 0, 600, 600, tileset, map, 0);

    //layer.resizeWorld();

    marker = game.add.graphics();
    marker.lineStyle(2, 0x00FF00, 1);
    marker.drawRect(0, 0, 100, 100);

    eurecaServer.getClients(myId);     
}

var currentTimeout = 0;

function updateMap() {
    for(var i = 0; i < 6; i++)
        for(var j = 0; j < 6; j++)
        {
            if (openmap[i][j] == -1)
                  flipBackSel(i, j);
            else
                flipOverSel(openmap[i][j], i * 100, j * 100);
        }
}

function updateNew() {
    for(var k = 0; k < changed.length; k++)
        {
            var i = changed[k].x;
            var j = changed[k].y;
            
            if (openmap[i][j] == -1)
                  flipBackSel(i, j);
            else
                flipOverSel(openmap[i][j], i * 100, j * 100);
        }
    changed = [];
}

function update() {
    if (!ready) return;
    if (!generated && seed != -1)
    {
        game.rnd.sow(seed);
        randomizeTiles();
        eurecaServer.loadMap(myId);
        generated = true;
        allowRender = true;
        return;
    }
    
    currentTimeout++;
    
    if (currentTimeout % loadFreq == 0)
    {
        eurecaServer.loadMap(myId);
        updateNew();
    }
    //updateMap();
    
    countDownTimer();
    
    for(var i = 0; i < clToRem.length; i++)
    {
        try {
            markersGrpaphics[clToRem[i]].pendingDestroy = true;
        } catch (e) {
        } finally { }
    }
    clToRem = [];

    for(var i = 0; i < clients.length; i++)
    {
        if (clients[i] === myId) continue;

        markersGrpaphics[clients[i]] = game.add.graphics();
        markersGrpaphics[clients[i]].lineStyle(2, 0xFF0000, 1);
        markersGrpaphics[clients[i]].drawRect(0, 0, 100, 100);
    }

    clLen = 0;
    clients = [];

    for (var i = 0; i < markersLen; i++)
    {
        try {
            var id = plmarkers[i][0];
            markersGrpaphics[id].x = plmarkers[i][1];
            markersGrpaphics[id].y = plmarkers[i][2];
        } catch (e) { }
    }
    plmarkers = [];
    markersLen = 0;
        
    if (layer.getTileX(game.input.activePointer.worldX) <= 5) // to prevent the marker from going out of bounds
    {
        marker.x = layer.getTileX(game.input.activePointer.worldX) * 100;
        marker.y = layer.getTileY(game.input.activePointer.worldY) * 100;
				eurecaServer.setMarker(myId, marker.x, marker.y)
    }
    
    if (flipFlag == true)
    {
        if (game.time.totalElapsedSeconds() - timeCheck > 0.5)
        {
            flipBack();
        }
    }
    else
    {
        if (flipFlag == true && game.time.totalElapsedSeconds() - timeCheck > 0.5) return;
        processClick();
    }
}


function countDownTimer() {
    var timeLimit = 520;

    mySeconds = game.time.totalElapsedSeconds();
    myCountdownSeconds = timeLimit - mySeconds;

    if (myCountdownSeconds <= 0)
    {
        timesUp = 'Time is up!';
        myCountdownSeconds = 0;
    }
}

var ispressed = false;

function processClick() {
    if (currentTimeout <= timeout) 
    {
        return;
    }
    
    currentTile = map.getTile(layer.getTileX(marker.x), layer.getTileY(marker.y));
    currentTilePosition = ((layer.getTileY(game.input.activePointer.worldY)+1)*6)-(6-(layer.getTileX(game.input.activePointer.worldX)+1));

    if (game.input.mousePointer.isDown)
    {
        eurecaServer.loadMap(myId);
        updateMap();
        currentTimeout = 0;
        // check to make sure the tile is not already flipped
        if (currentTile.index == tileBack)
        {
            // get the corresponding item out of squareList
            currentNum = squareList[currentTilePosition-1];
            flipOver();
            squareCounter++;
            // is the second tile of pair flipped?
            if  (squareCounter == 2)
            {
                // reset squareCounter
                squareCounter = 0;
                square2Num = currentNum;
                // check for match
                if (square1Num == square2Num)
                {
                    masterCounter++;
                }
                else
                {
                    savedSquareX2 = layer.getTileX(marker.x);
                    savedSquareY2 = layer.getTileY(marker.y);
                    flipFlag = true;
                    timeCheck = game.time.totalElapsedSeconds();
                }
            }
            else
            {
                savedSquareX1 = layer.getTileX(marker.x);
                savedSquareY1 = layer.getTileY(marker.y);
                square1Num = currentNum;
            }
        }
    }
}

function flipOverSel(num, x, y) {
    map.putTile(num, layer.getTileX(x), layer.getTileY(y));
}

function flipOver() {
    openmap[marker.x/100][marker.y/100] = currentNum;
    map.putTile(currentNum, layer.getTileX(marker.x), layer.getTileY(marker.y));
    eurecaServer.openTile(myId, currentNum, marker.x, marker.y);
}

function flipBackSel(x1, y1) {
    map.putTile(tileBack, x1, y1);
}

function flipBack() {

    flipFlag = false;
        
    map.putTile(tileBack, savedSquareX1, savedSquareY1);
    map.putTile(tileBack, savedSquareX2, savedSquareY2);

    openmap[savedSquareX1][savedSquareY1] = -1;
    openmap[savedSquareX2][savedSquareY2] = -1;

    eurecaServer.closeTile(myId, savedSquareX1, savedSquareY1);
    eurecaServer.closeTile(myId, savedSquareX2, savedSquareY2);
}

function randomizeTiles() {

    for (num = 1; num <= 18; num++)
    {
        startList.push(num);
    }
    for (num = 1; num <= 18; num++)
    {
        startList.push(num);
    }

    // for debugging
    myString1 = startList.toString();

    // randomize squareList
    for (i = 1; i <=36; i++)
    {
        var randomPosition = game.rnd.integerInRange(0,startList.length - 1);

        var thisNumber = startList[ randomPosition ];

        squareList.push(thisNumber);
        var a = startList.indexOf(thisNumber);

        startList.splice( a, 1);
    }

    // for debugging
    myString2 = squareList.toString();

    for (col = 0; col < 6; col++)
    {
        for (row = 0; row < 6; row++)
        {
            map.putTile(tileBack, col, row);
        }
    }
   
}

function getHiddenTile() {
    thisTile = squareList[currentTilePosition-1];
    return thisTile;
}

function render() {
    if (!ready || !generated) return;
    if (!allowRender) return;
}
