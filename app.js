const fs = require('fs');
const request = require('request-promise');
const config = require('./config.json');

const Discord = require('discord.js');
const client = new Discord.Client();

const pollInterval = 60*60*1000; // Poll AmiAmi pages every hour

const logSomething = function(text) {
  console.log(new Date().toISOString() + ' | ' + text);
};

const checkLinks = function() {
  logSomething('Checking for link updates...');
  logSomething('Done!');
};

client.on('ready', ()=>{
  client.user.setActivity(config.discordActivity);
  checkLinks();
});

if (!fs.existsSync('./database.json')) {
  logSomething('Creating database file...');
  fs.writeFileSync('./database.json', '{}');
}

client.login(config.token);
setInterval(checkLinks, pollInterval);
