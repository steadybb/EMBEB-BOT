module.exports = client => {
  client.once('ready', () => {
    console.log(`✅ steadybomber Logged in as ${client.user.tag}`);
  });
};
