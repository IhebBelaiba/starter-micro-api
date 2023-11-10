const SERVER_NAME = 'alpha';
const URL = 'wss://werewolves-server1.herokuapp.com';
const MAX_ROOMS = 5;
const MAX_PLAYERS = 50;

class Server {
  constructor() {
    //Clients
    this.count = 0;
    this.creator = 0;
    this.clientList = [];
    this.userList = [];
    this.roleList = [];
    this.voted = [];
    this.votes = [];
    this.dead = [];
    this.pointList = [];
    //Game general
    this.GameStarted = false;
    this.gameplayers = 1;
    this.allCards = [];
    this.EndTimeout;
    this.ServerTicks;
    this.name = "";
    this.toProceed;
    //rules
    this.mustFire = true;
    //cards
    this.PharmacistID = -1;
    this.GirlID = -1;
    this.CupidID = -1;
    this.Cupid = false;
    this.Seer = false;
    this.Pharmacist = false;
    this.Girl = false;
    this.Thief = false;
    this.CupidExist = false;
    this.SeerExist = false;
    this.PharmacistExist = false;
    this.GirlExist = false;
    //Cupid
    this.CupidActive = false;
    this.CupidPicked = false;
    this.Lover1 = -1;
    this.Lover2 = -1;
    //Seer
    this.SeerActive = false;
    //Wolves
    this.WolfActive = false;
    this.Victim = -1;
    //Pharmacist
    this.PharmacistActive = false;
    this.UsedPotion1 = false;
    this.UsedPotion2 = false;
    this.SaveTonight = false;
    this.Poisoned = -1;
    //Hunter
    this.HunterShot = false;
    //Day
    this.DayActive = false;

    //Initialize
    for(let i = 0; i < MAX_PLAYERS; i++) {
      this.clientList[i] = -1;
      this.userList[i] = "";
      this.roleList[i] = 0;
      this.voted[i] = -1;
      this.votes[i] = 0;
      this.dead[i] = false;
      this.pointList[i] = 0;
    }
  }
  addClient(client, username) {
    for(let i = 0; i < MAX_PLAYERS; i++) {
      if (this.userList[i].localeCompare(username) == 0) {
        this.clientList[i] = client;
        return i;
      }
      else if (this.clientList[i] == -1) {
        this.clientList[i] = client;
        this.userList[i] = username;
        this.count++;
        return i;
      }
    }
  }
  removeClient(client) {
    for(let i = 0; i < MAX_PLAYERS; i++) {
      if (this.clientList[i] == client) {
        this.clientList[i] = -1;
        this.userList[i] = "";
        this.count--;
        break;
      }
    }
  }
}

function getIdentifiers(socket) {
  for(let i = 0; i < MAX_PLAYERS; i++) {
    for(let r = 0; r < MAX_ROOMS; r++) {
      if (server[r].clientList[i] == socket) return [r, i];
    }
  }
  return [-1, -1];
}

//MySQL
var mysql = require('mysql');
var con = mysql.createConnection({
  host: "79.137.5.88",
  user: "theatrec_werewolves",
  password: "29gOY79LWk}m#=PV"
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

//Create Servers
var server = [];
for(let i = 0; i < MAX_ROOMS; i++) {
  server[i] = new Server();
}

//Setup Servers in firebase
for(let r = 0; r < MAX_ROOMS; r++) {
  server[r].name = 'Room '+(r+1);
  /*ref.child(r).set({
    active: false,
    running: false,
    name: server[r].name,
    creator: '',
    server: SERVER_NAME,
    url: URL,
    room: r,
    players: 1,
    max: 7,
    cards: [],
    mustTalk: true,
    mustLove: false,
    mustFire: true,
    mustPoison: false
  });*/
}

//ServerCreation
const WebSocket = require("ws");
const PORT = process.env.PORT || 3000;
const wsServer = new WebSocket.Server({
  port: PORT,
});
console.log("Server Started");

//Realtime
wsServer.on("connection", function (socket) {
  console.log("new connection");
  socket.on("message", function (msg) {
    //new message
    let data = JSON.parse(msg);
    let roomid = data.room;
    if (roomid >= 0 && roomid < MAX_ROOMS)
    {
      switch (data.type) {
        case 0: //ping
          socket.send('{ "type": 0 }'); //pong
          break;
        case 1: //connect
          let playerid = server[roomid].addClient(socket, data.name);
          console.log("Room("+roomid+") : "+server[roomid].userList[playerid] + "(" + playerid + ") connected");
          SendToAllClients(roomid, '{ "type": 1, "id": ' + playerid + ', "name": "' + data.name + '"}');
          if (data.players) {
            console.log("Setting up room");
            server[roomid].name = data.title;
            server[roomid].gameplayers = data.players;
            server[roomid].allCards = data.cards;
            server[roomid].creator = playerid;

            /*ref.child(roomid).update({
              active: true,
              name: server[roomid].name,
              creator: server[roomid].userList[server[roomid].creator],
              max: server[roomid].gameplayers,
              cards: server[roomid].allCards
            });*/
            server[roomid].ServerTicks = setInterval(function() { SendToAllClients(roomid, '{ "type": 0 }'); }, 10000);
          }
          SendToClient(roomid, playerid, JSON.stringify({ type: 4, id: playerid, namelist: server[roomid].userList }));
          /*ref.child(roomid).update({
            players: server[roomid].count
          });*/
          break;
        case 3: //message
          if(server[roomid].GameStarted)
          {
            if(server[roomid].DayActive && !server[roomid].dead[data.id])
            {
              SendToAllClients(roomid, '{ "type": 3, "name": "'+server[roomid].userList[data.id]+'", "message": "'+data.message +'" }');
            }
            else if(server[roomid].WolfActive && isWolf(server[roomid].roleList[data.id]))
            {
              SendToWolves(roomid, '{ "type": 6, "name": "'+server[roomid].userList[data.id]+'", "message": "'+data.message +'" }');
              SendToClient(roomid, server[roomid].GirlID, '{ "type": 6, "name": "wolf", "message": "'+data.message +'" }');
            }
            else if(server[roomid].dead[data.id])
            {
              SendToDead(roomid, '{ "type": 3, "name": "'+server[roomid].userList[data.id]+' (dead)", "message": "'+data.message +'" }');
            }
          }
          else SendToAllClients(roomid, '{ "type": 3, "name": "'+server[roomid].userList[data.id]+'", "message": "'+data.message +'" }');
          break;
        case 10: //startgame
          let CanStart = true;
          for(let i = 0; i < server[roomid].gameplayers; i++) {
            if(!isConnected(roomid, i)) {
              CanStart = false;
            }
          }
          if(CanStart)
          {
            server[roomid].GameStarted = true;
            SendToAllClients(roomid, '{ "type": 9 }');
            setTimeout(function() { AssignRoles(roomid); }, 3000);
            /*ref.child(roomid).update({
              running: true
            });*/
          }
          else
          {
              SendToClient(roomid, data.id, '{ "type": 8 }');
          }
          break;
        case 22: //seer spy
          if(server[roomid].roleList[data.id] == 3 && server[roomid].SeerActive && !server[roomid].dead[data.id])
          {
              clearTimeout(server[roomid].EndTimeout);
              let spied = data.seer;
              SendToClient(roomid, data.id, JSON.stringify({ type: 22, spied_id: spied, spied_role: server[roomid].roleList[spied] }));
              EndSeer(roomid);
          }
          break;
        case 32: //wolf vote
          if(server[roomid].WolfActive && !server[roomid].dead[data.id])
          {
            if(server[roomid].voted[data.id]!=-1) server[roomid].votes[server[roomid].voted[data.id]]--;
            let unvoted = server[roomid].voted[data.id];
            server[roomid].voted[data.id] = data.victim;
            if(data.victim != -1) server[roomid].votes[data.victim]++;
            SendToWolves(roomid, JSON.stringify({ type: 32, voter: data.id, voted: data.victim, unvoted: unvoted }));
          }
          break;
        case 40: //Pharmacist do nothing
          if(server[roomid].roleList[data.id] == 5 && server[roomid].PharmacistActive && !server[roomid].dead[data.id])
          {
            console.log("Pharmacist ended timer");
            clearTimeout(server[roomid].EndTimeout);
            EndPharmacist(roomid);
          }
          break;
        case 41: //Pharmacist potion 1
          if(server[roomid].roleList[data.id] == 5 && !server[roomid].UsedPotion1 && server[roomid].PharmacistActive && !server[roomid].dead[data.id])
          {
            console.log("Pharmacist used healing potion");
            server[roomid].UsedPotion1 = true;
            server[roomid].SaveTonight = true;
          }
          break;
        case 42: //Pharmacist potion 2
          if(server[roomid].roleList[data.id] == 5 && !server[roomid].UsedPotion2 && server[roomid].PharmacistActive && !server[roomid].dead[data.id])
          {
            console.log("Pharmacist used poisoning potion");
            server[roomid].UsedPotion2 = true;
            server[roomid].Poisoned = data.poisoned;
          }
          break;
        case 50: //accuse
          if(server[roomid].DayActive && !server[roomid].dead[data.id])
          {
            if(server[roomid].voted[data.id]!=-1) server[roomid].votes[server[roomid].voted[data.id]]--;
            let unaccused = server[roomid].voted[data.id];
            server[roomid].voted[data.id] = data.accused;
            if(data.accused != -1) server[roomid].votes[data.accused]++;
            SendToAllClients(roomid, JSON.stringify({ type: 53, accuser: data.id, accused: data.accused, unaccused: unaccused }));
          }
          break;
        case 70: //hunter shot
          if(server[roomid].roleList[data.id] == 6 && server[roomid].HunterActive)
          {
            if(!server[roomid].HunterShot)
            {
              clearTimeout(server[roomid].EndTimeout);
              if(isValid(data.shot))
              {
                server[roomid].Victim = data.shot;
                server[roomid].HunterShot = true;
              }
              EndHunter(roomid);
            }
          }
          break;
        case 12: //cupid selected
          if(server[roomid].roleList[data.id] == 7 && server[roomid].CupidActive)
          {
            if(!server[roomid].CupidPicked)
            {
              clearTimeout(server[roomid].EndTimeout);
              if(isValid(data.lover1) && isValid(data.lover2))
              {
                server[roomid].Lover1 = data.lover1;
                server[roomid].Lover2 = data.lover2;
                server[roomid].CupidPicked = true;
              }
              EndCupid(roomid);
            }
          }
          break;
        default:
        // code block
      }
    }
    else console.log("Invalid Connection !");
  });
  socket.on("close", function (code, reason) {
    let values = getIdentifiers(socket);
    let roomid = values[0];
    let playerid = values[1];
    if(roomid != -1)
    {
      console.log(server[roomid].userList[playerid] + "(" + playerid + ") disconnected");
      server[roomid].removeClient(socket);
      if(!server[roomid].GameStarted) {
        SendToAllClients(roomid, JSON.stringify({ type: 2, id: playerid }));
        if(playerid == server[roomid].creator) {
          if(server[roomid].count == 0) EndServer(roomid);
          for(let i = 0; i < server[roomid].gameplayers; i++) {
            if(isConnected(roomid, i)) {
              server[roomid].creator = i;
              SendToAllClients(roomid, JSON.stringify({ type: 15, leader: server[roomid].creator }));
              break;
            }
          }
        }
        /*ref.child(roomid).update({
          players: server[roomid].count
        });*/
      }
    }
  });
});
function AssignRoles(roomid) {
  for(let card of server[roomid].allCards) {
    switch(card) {
      case 3:
        server[roomid].Seer=true;
        break;
      case 4:
        server[roomid].Girl=true;
        break;
      case 5:
        server[roomid].Pharmacist=true;
        break;
      case 7:
        server[roomid].Cupid=true;
        break;
      case 8:
        server[roomid].Thief=true;
        break;
    }
  }
  shuffle(server[roomid].allCards);
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(isConnected(roomid, i))
    {
      server[roomid].roleList[i] = server[roomid].allCards[i];
      switch(server[roomid].allCards[i]) {
        case 3:
          server[roomid].SeerExist=true;
          break;
        case 4:
          server[roomid].GirlExist=true;
          server[roomid].GirlID = i;
          break;
        case 5:
          server[roomid].PharmacistExist=true;
          server[roomid].PharmacistID = i;
          break;
        case 7:
          server[roomid].CupidExist=true;
          server[roomid].CupidID = i;
          break;
      }
    }
  }
  for(let cltid = 0; cltid < server[roomid].gameplayers; cltid++) {
    SendToClient(roomid, cltid, JSON.stringify({
      type: 10,
      role: server[roomid].roleList[cltid],
    }));
  }
  let wolves = [];
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(isWolf(server[roomid].roleList[i])) {
      wolves.push(i);
    }
  }
  SendToWolves(roomid, JSON.stringify({ type: 5, wolves: wolves }));
  setTimeout(function() { StartCupid(roomid); }, 5000);
}
function StartCupid(roomid) {
  if(server[roomid].Cupid)
  {
    if(server[roomid].CupidExist)
    {
      server[roomid].CupidActive = true;
      SendToAllClients(roomid, '{ "type": 11 }');
      server[roomid].EndTimeout = setTimeout(function() { EndCupid(roomid); }, 20000);
    }
    else setTimeout(function() { StartSeer(roomid); }, (Math.floor(Math.random() * 10000) + 4000));
  }
  else StartSeer(roomid);
}
function EndCupid(roomid) {
  server[roomid].CupidActive = false;
  if(!server[roomid].CupidPicked)
  {
    server[roomid].CupidPicked = true; // picked by server
    server[roomid].Lover1 = Math.floor(Math.random() * server[roomid].gameplayers);
    server[roomid].Lover2 = server[roomid].Lover1;
    while(server[roomid].Lover2 == server[roomid].Lover1)
    {
      server[roomid].Lover2 = Math.floor(Math.random() * server[roomid].gameplayers);
      console.log("Repicking");
    }
  }
  SendToClient(roomid, server[roomid].Lover1, JSON.stringify({ type: 12, lover: server[roomid].Lover2, lover_role: server[roomid].roleList[server[roomid].Lover2] }));
  SendToClient(roomid, server[roomid].Lover2, JSON.stringify({ type: 12, lover: server[roomid].Lover1, lover_role: server[roomid].roleList[server[roomid].Lover1] }));
  SendToClient(roomid, server[roomid].CupidID, JSON.stringify({ type: 13, lover1: server[roomid].Lover1, lover2: server[roomid].Lover2 }));
  setTimeout(function() { StartSeer(roomid); }, 1000);
}
function StartSeer(roomid) {
  if(server[roomid].Seer)
  {
    if(server[roomid].SeerExist)
    {
      server[roomid].SeerActive = true;
      SendToAllClients(roomid, '{ "type": 21 }');
      server[roomid].EndTimeout = setTimeout(function() { EndSeer(roomid); }, 20000);
    }
    else setTimeout(function() { StartWolves(roomid); }, (Math.floor(Math.random() * 10000) + 4000));
  }
  else StartWolves(roomid);
}
function EndSeer(roomid) {
  server[roomid].SeerActive = false;
  setTimeout(function() { StartWolves(roomid); }, 1500);
}
function StartWolves(roomid) {
  server[roomid].WolfActive = true;
  SendToAllClients(roomid, JSON.stringify({ type: 31, girl: server[roomid].GirlExist }));
  setTimeout(function() { EndWolves(roomid); }, 25000);
}
function EndWolves(roomid) {
  server[roomid].WolfActive = false;
  SendToWolves(roomid, '{ "type": 33 }');
  let highestvotes = 0;
  let highestvoted = -1;
  let duplicated = true;
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(server[roomid].votes[i] > highestvotes)
    {
      highestvotes = server[roomid].votes[i];
      highestvoted = i;
      duplicated = false;
    }
    else if(server[roomid].votes[i] == highestvotes)
    {
      duplicated = true;
    }
    server[roomid].votes[i] = 0;
    server[roomid].voted[i] = -1;
  }
  if(duplicated) server[roomid].Victim = -1;
  else server[roomid].Victim = highestvoted;
  SendToWolvesAndPharmacist(roomid, JSON.stringify({ type: 34, victim: server[roomid].Victim }));
  setTimeout(function() { StartPharmacist(roomid); }, 1500);
}
function StartPharmacist(roomid) {
  if(server[roomid].Pharmacist && (!server[roomid].UsedPotion1 || !server[roomid].UsedPotion2))
  {
    if(server[roomid].PharmacistExist)
    {
      server[roomid].PharmacistActive = true;
      SendToAllClients(roomid, '{ "type": 41 }');
      server[roomid].EndTimeout = setTimeout(function() { EndPharmacist(roomid); }, 25000);
    }
    else setTimeout(function() { StartDay(roomid); }, (Math.floor(Math.random() * 10000) + 4000));
  }
  else StartDay(roomid);
}
function EndPharmacist(roomid) {
  server[roomid].PharmacistActive = false;
  SendToClient(roomid, server[roomid].PharmacistID, '{ "type": 42 }');
  setTimeout(function() { StartDay(roomid); }, 1500);
}
function StartDay(roomid) {
  server[roomid].DayActive = true;
  SendToAllClients(roomid, '{ "type": 50 }');
  let healed = false;
  let dead1 = -1;
  let dead1_role = -1;
  let lover1 = -1;
  let lover1_role = -1;
  let dead2 = -1;
  let dead2_role = -1;
  let lover2 = -1;
  let lover2_role = -1;
  if(server[roomid].Victim != -1) //there is a victim
  {
    if(!server[roomid].SaveTonight) //Pharmacist didn't save him
    {
      KillPlayer(roomid, server[roomid].Victim); //kill him
      dead1 = server[roomid].Victim;
      dead1_role = server[roomid].roleList[server[roomid].Victim];

      if(server[roomid].Victim == server[roomid].Lover1) //if first lover
      {
        KillPlayer(roomid, server[roomid].Lover2); //kill second lover
        lover1 = server[roomid].Lover2;
        lover1_role = server[roomid].roleList[server[roomid].Lover2];
      }
      else if(server[roomid].Victim == server[roomid].Lover2) //if second lover
      {
        KillPlayer(roomid, server[roomid].Lover1); //kill first lover
        lover1 = server[roomid].Lover1;
        lover1_role = server[roomid].roleList[server[roomid].Lover1];
      }
    }
    else
    {
      healed = true;
      server[roomid].SaveTonight = false;
    }
    server[roomid].Victim = -1;
  }
  if(server[roomid].Poisoned != -1)
  {
    KillPlayer(roomid, server[roomid].Poisoned); //kill with poison
    dead2 = server[roomid].Poisoned;
    dead2_role = server[roomid].roleList[server[roomid].Poisoned];

    if(server[roomid].Poisoned == server[roomid].Lover1) //if first lover
    {
      KillPlayer(roomid, server[roomid].Lover2); //kill second lover
      lover2 = server[roomid].Lover2;
      lover2_role = server[roomid].roleList[server[roomid].Lover2];
    }
    else if(server[roomid].Poisoned == server[roomid].Lover2) //if second lover
    {
      KillPlayer(roomid, server[roomid].Lover1); //kill first lover
      lover2 = server[roomid].Lover1;
      lover2_role = server[roomid].roleList[server[roomid].Lover1];
    }
    server[roomid].Poisoned = -1;
  }
  SendToAllClients(roomid, JSON.stringify({
    type: 51,
    healed: healed,
    dead1: dead1,
    dead1_role: dead1_role,
    lover1: lover1,
    lover1_role: lover1_role,
    dead2: dead2,
    dead2_role: dead2_role,
    lover2: lover2,
    lover2_role: lover2_role
  }));
  let alives = 0;
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(isConnected(roomid, i) && !server[roomid].dead[i]) {
      alives++;
    }
  }
  if(alives > 0 && (dead1_role == 6 || lover1_role == 6 || dead2_role == 6 || lover2_role == 6))
  {
    StartHunter(roomid, ProceedDay);
  } else ProceedDay(roomid);
}
function StartHunter(roomid, proceed) {
  server[roomid].toProceed = proceed;
  server[roomid].HunterActive = true;
  SendToAllClients(roomid, JSON.stringify({ type: 70, duty: server[roomid].mustFire }));
  server[roomid].EndTimeout = setTimeout(function() { EndHunter(roomid); }, 20000);
}

function EndHunter(roomid) {
  server[roomid].HunterActive = false;
  if(!server[roomid].HunterShot) {
    if(server[roomid].mustFire) {
      console.log("Server shot!");
      server[roomid].HunterShot = true; // picked by server
      server[roomid].Victim = Math.floor(Math.random() * server[roomid].gameplayers);
      while(server[roomid].dead[server[roomid].Victim])
        server[roomid].Victim = Math.floor(Math.random() * server[roomid].gameplayers);
    }
  }
  if(server[roomid].HunterShot)
  {
    console.log("Shooting!");
    let dead = -1;
    let dead_role = -1;
    let lover = -1;
    let lover_role = -1;
    if(server[roomid].Victim != -1)
    {
      KillPlayer(roomid, server[roomid].Victim);
      dead = server[roomid].Victim;
      dead_role = server[roomid].roleList[server[roomid].Victim];

      if(server[roomid].Victim == server[roomid].Lover1) //if first lover
      {
        KillPlayer(roomid, server[roomid].Lover2); //kill second lover
        lover = server[roomid].Lover2;
        lover_role = server[roomid].roleList[server[roomid].Lover2];
      }
      else if(server[roomid].Victim == server[roomid].Lover2) //if second lover
      {
        KillPlayer(roomid, server[roomid].Lover1); //kill first lover
        lover = server[roomid].Lover1;
        lover_role = server[roomid].roleList[server[roomid].Lover1];
      }
      server[roomid].Victim = -1;
    }
    SendToAllClients(roomid, JSON.stringify({
      type: 55,
      dead: dead,
      dead_role: dead_role,
      lover: lover,
      lover_role: lover_role,
      shot: true
    }));
  }
  server[roomid].toProceed(roomid);
}
function ProceedDay(roomid) {
  console.log("ProceedDay");
  if(CheckResults(roomid)) EndGame(roomid);
  else {
    SendToAllClients(roomid, '{ "type": 52 }');
    server[roomid].EndTimeout = setTimeout(function() { EndDay(roomid); }, 90000);
  }
}
function EndDay(roomid) {
  server[roomid].DayActive = false;
  let highestvotes = 0;
  let highestvoted = -1;
  let duplicated = true;
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(server[roomid].votes[i] > highestvotes)
    {
      highestvotes = server[roomid].votes[i];
      highestvoted = i;
      duplicated = false;
    }
    else if(server[roomid].votes[i] == highestvotes)
    {
      duplicated = true;
    }
    server[roomid].votes[i] = 0;
    server[roomid].voted[i] = -1;
  }
  if(duplicated) server[roomid].Victim = -1;
  else server[roomid].Victim = highestvoted;
  SendToAllClients(roomid, JSON.stringify({ type: 54, victim: server[roomid].Victim }));

  let dead = -1;
  let dead_role = -1;
  let lover = -1;
  let lover_role = -1;
  if(server[roomid].Victim != -1) //there is a victim
  {
    KillPlayer(roomid, server[roomid].Victim);
    dead = server[roomid].Victim;
    dead_role = server[roomid].roleList[server[roomid].Victim];

    if(server[roomid].Victim == server[roomid].Lover1) //if first lover
    {
      KillPlayer(roomid, server[roomid].Lover2); //kill second lover
      lover = server[roomid].Lover2;
      lover_role = server[roomid].roleList[server[roomid].Lover2];
    }
    else if(server[roomid].Victim == server[roomid].Lover2) //if second lover
    {
      KillPlayer(roomid, server[roomid].Lover1); //kill first lover
      lover = server[roomid].Lover1;
      lover_role = server[roomid].roleList[server[roomid].Lover1];
    }
    server[roomid].Victim = -1;
  }
  SendToAllClients(roomid, JSON.stringify({
    type: 55,
    dead: dead,
    dead_role: dead_role,
    lover: lover,
    lover_role: lover_role,
    shot: false
  }));
  let alives = 0;
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(isConnected(roomid, i) && !server[roomid].dead[i]) {
      alives++;
    }
  }
  if(alives > 0 && (dead_role == 6 || lover_role == 6))
  {
    StartHunter(roomid, ProceedNight);
  } else ProceedNight(roomid);
}
function ProceedNight(roomid) {
  console.log("ProceedNight");
  if(CheckResults(roomid)) EndGame(roomid);
  else StartNight(roomid);
}
function StartNight(roomid) {
  SendToAllClients(roomid, '{ "type": 60 }');
  setTimeout(function() { StartSeer(roomid); }, 1000);
}
//
function CheckResults(roomid) {
  let wolves_left = 0;
  let villagers_left = 0;
  let alives = 0;
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(isConnected(roomid, i) && !server[roomid].dead[i]) {
      alives++;
      if(isWolf(server[roomid].roleList[i])) wolves_left++;
      else villagers_left++;
    }
  }
  if(alives == 2 && server[roomid].CupidExist) {
    if(!server[roomid].dead[server[roomid].Lover1] && !server[roomid].dead[server[roomid].Lover2]) {
      console.log("Lovers won!");
      server[roomid].pointList[server[roomid].Lover1] = 5;
      server[roomid].pointList[server[roomid].Lover2] = 5;
      for(let i = 0; i < server[roomid].gameplayers; i++) {
        if(server[roomid].pointList[i] != 0) {
          server[roomid].pointList[i]=1;
        }
      }
      SendToAllClients(roomid, JSON.stringify({ type: 100, result: 3, rolelist: server[roomid].roleList, scorelist: server[roomid].pointList }));
      return true;
    }
  }
  if(alives == 0) {
    console.log("Draw!");
    for(let i = 0; i < server[roomid].gameplayers; i++) {
      server[roomid].pointList[i]=1;
    }
    SendToAllClients(roomid, JSON.stringify({ type: 100, result: 0, rolelist: server[roomid].roleList, scorelist: server[roomid].pointList }));
    return true;
  }
  else if(wolves_left == 0) {
    console.log("Villagers won!");
    for(let i = 0; i < server[roomid].gameplayers; i++) {
      if(isWolf(server[roomid].roleList[i])) server[roomid].pointList[i]=1;
      else server[roomid].pointList[i]=3;
    }
    SendToAllClients(roomid, JSON.stringify({ type: 100, result: 1, rolelist: server[roomid].roleList, scorelist: server[roomid].pointList }));
    return true;
  }
  else if(wolves_left > 0 && villagers_left <= 1) {
    console.log("Wolves won!");
    for(let i = 0; i < server[roomid].gameplayers; i++) {
      if(isWolf(server[roomid].roleList[i])) server[roomid].pointList[i]=3;
      else server[roomid].pointList[i]=1;
    }
    SendToAllClients(roomid, JSON.stringify({ type: 100, result: 2, rolelist: server[roomid].roleList, scorelist: server[roomid].pointList }));
    return true;
  }
  return false;
}
function EndGame(roomid) {
  server[roomid].GameStarted = false;
  server[roomid].EndTimeout = setTimeout(function() { EndServer(roomid); }, 61000);
}
function EndServer(roomid) {
  clearInterval(server[roomid].ServerTicks);
  KickAllPlayers(roomid);
  ResetServer(roomid);
}
//-----------------------------------------------------------
//
// Functions
//
//-----------------------------------------------------------
function SendToAllClients(roomid, str) {
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(isConnected(roomid, i)) server[roomid].clientList[i].send(str);
  }
}
function SendToClient(roomid, clientid, str) {
  if(isConnected(roomid, clientid)) server[roomid].clientList[clientid].send(str);
}
function SendToWolves(roomid, str) {
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(isWolf(server[roomid].roleList[i]) && isConnected(roomid, i)) server[roomid].clientList[i].send(str);
  }
}
function SendToDead(roomid, str) {
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(server[roomid].dead[i] && isConnected(roomid, i)) server[roomid].clientList[i].send(str);
  }
}
function SendToWolvesAndPharmacist(roomid, str) {
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(isWolf(server[roomid].roleList[i]) || (server[roomid].roleList[i] == 5)) {
      if(isConnected(roomid, i)) server[roomid].clientList[i].send(str);
    }
  }
}
function isConnected(roomid, id)
{
  return (server[roomid].clientList[id] != -1);
}
function isValid(id)
{
  return (id > -1 && id < MAX_PLAYERS);
}
function isWolf(role)
{
  return role == 2 || role == 18 || role == 19;
}
function KillPlayer(roomid, id)
{
  server[roomid].dead[id] = true;
  switch(server[roomid].roleList[id]) {
    case 3:
      server[roomid].Seer=false;
      server[roomid].SeerExist=false;
      break;
    case 4:
      server[roomid].Girl=false;
      server[roomid].GirlExist=false;
      break;
    case 5:
      server[roomid].Pharmacist=false;
      server[roomid].PharmacistExist=false;
      break;
    case 7:
      server[roomid].Cupid=false;
      server[roomid].CupidExist=false;
      break;
  }
}
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}
function KickAllPlayers(roomid)
{
  for(let i = 0; i < server[roomid].gameplayers; i++) {
    if(isConnected(roomid, i)) server[roomid].clientList[i].terminate();
  }
}
function ResetServer(roomid)
{
  server[roomid].count = 0;
  server[roomid].creator = 0;
  //Game general
  server[roomid].GameStarted = false;
  server[roomid].gameplayers = 1;
  server[roomid].allCards = [];
  server[roomid].name = 'Room '+(roomid+1);
  //cards
  server[roomid].PharmacistID = -1;
  server[roomid].GirlID = -1;
  server[roomid].CupidID = -1;
  server[roomid].Cupid = false;
  server[roomid].Seer = false;
  server[roomid].Pharmacist = false;
  server[roomid].Girl = false;
  server[roomid].Thief = false;
  server[roomid].CupidExist = false;
  server[roomid].SeerExist = false;
  server[roomid].PharmacistExist = false;
  server[roomid].GirlExist = false;
  //Cupid
  server[roomid].CupidActive = false;
  server[roomid].CupidPicked = false;
  server[roomid].Lover1 = -1;
  server[roomid].Lover2 = -1;
  //Seer
  server[roomid].SeerActive = false;
  //Wolves
  server[roomid].WolfActive = false;
  server[roomid].Victim = -1;
  //Pharmacist
  server[roomid].PharmacistActive = false;
  server[roomid].UsedPotion1 = false;
  server[roomid].UsedPotion2 = false;
  server[roomid].SaveTonight = false;
  server[roomid].Poisoned = -1;
  //Hunter
  server[roomid].HunterShot = false;
  //Day
  server[roomid].DayActive = false;

  //Initialize
  for(let i = 0; i < MAX_PLAYERS; i++) {
    server[roomid].clientList[i] = -1;
    server[roomid].userList[i] = "";
    server[roomid].roleList[i] = 0;
    server[roomid].voted[i] = -1;
    server[roomid].votes[i] = 0;
    server[roomid].dead[i] = false;
    server[roomid].pointList[i] = 0;
  }

  /*ref.child(roomid).update({
    active: false,
    running: false,
    name: server[roomid].name,
    creator: '',
    server: SERVER_NAME,
    url: URL,
    room: roomid,
    players: 1,
    max: 7,
    cards: [],
    mustTalk: true,
    mustLove: false,
    mustFire: true,
    mustPoison: false
  });*/
  console.log("Room("+roomid+") : reset.");
}
