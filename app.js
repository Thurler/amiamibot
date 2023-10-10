const fs = require('fs');
const exec = require('child_process').exec;
const request = require('request-promise');
const config = require('./config.json');

const Discord = require('discord.js');
const client = new Discord.Client({
  intents: [Discord.GatewayIntentBits.MessageContent],
});

const Product = require('./product');

const pollInterval = 60*60*1000; // Poll AmiAmi pages every hour

const sleep = function(ms) {
  const finalMs = ms + ms*((Math.random() * 0.2) - 0.1);
  return new Promise((resolve) => setTimeout(resolve, finalMs));
};

const logSomething = function(text) {
  console.log(new Date().toISOString() + ' | ' + text);
};

const getProductsFromChannel = async function(channel) {
  const messages = await channel.messages.fetch({limit: 100, cache: false});
  const products = [];
  for (const message of messages) {
    for (const line of message[1].content.split('\n')) {
      if (line.includes('https')) {
        products.push(new Product(line));
      }
    }
  }
  return products;
};

const checkProductStock = function(product) {
  logSomething(`Checking ${product.title}...`);
  const url = `'https://api.amiami.com/api/v1.0/item?${product.code}&lang=eng'`;
  const commandParts = [
    config.curlImpersonatePath,
    '-s',
    '-H',
    "'X-User-Key: amiami_dev'",
    url,
  ];
  return new Promise((resolve, reject) => {
    exec(commandParts.join(' '), (error, stdout, stderr) => {
      try {
        const response = JSON.parse(stdout);
        if (!response.hasOwnProperty('RSuccess')) {
          logSomething(`URL (${url}) did not have RSuccess key`);
          return resolve({success: false, exists: false, inStock: false});
        }
        if (!response['RSuccess']) {
          return resolve({success: true, exists: false, inStock: false});
        }
        if (!response.hasOwnProperty('item')) {
          logSomething(`URL (${url}) succeeded but did not have item key`);
          return resolve({success: false, exists: false, inStock: false});
        }
        if (!response['item'].hasOwnProperty('cart_type')) {
          logSomething(`URL (${url}) succeeded but did not have cart_type key`);
          return resolve({success: false, exists: false, inStock: false});
        }
        const inStock = response['item']['cart_type'] === 8;
        resolve({success: true, exists: true, inStock: inStock});
      } catch (err) {
        logSomething(`Exception parsing url (${url}): ${err}`);
        resolve({success: false, exists: false, inStock: false});
      }
    });
  });
};

const checkProductDied = async function(product, channel) {
  const checkResult = await checkProductStock(product);
  if (!checkResult.success || checkResult.inStock) {
    return;
  }
  const messageSuffix = (checkResult.exists) ? 'in stock' : 'available';
  const message = `${product.title} is no longer ${messageSuffix}: ${product.link}`;
  logSomething(message);
  await channel.send(message);
};

const checkProductRevived = async function(product, channel) {
  const checkResult = await checkProductStock(product);
  if (!checkResult.success || (checkResult.exists && !checkResult.inStock)) {
    return;
  }
  const messageSuffix = (checkResult.exists) ? 'back in stock' : 'no longer available';
  const message = `${product.title} is ${messageSuffix}: ${product.link}`;
  logSomething(message);
  await channel.send(message);
};

const checkLinks = async function() {
  logSomething('Checking for link updates...');
  const server = await client.guilds.fetch(config.server);
  const noticeChannel = await server.channels.fetch(config.noticeChannel);
  const preorderChannel = await server.channels.fetch(config.preorderChannel);
  const preorderProducts = await getProductsFromChannel(preorderChannel);
  for (const product of preorderProducts) {
    await checkProductDied(product, noticeChannel);
    await sleep(500);
  }
  const deadChannel = await server.channels.fetch(config.deadChannel);
  const deadProducts = await getProductsFromChannel(deadChannel);
  for (const product of deadProducts) {
    await checkProductRevived(product, noticeChannel);
    await sleep(500);
  }
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
