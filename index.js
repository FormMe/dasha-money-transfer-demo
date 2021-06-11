const dasha = require("@dasha.ai/sdk");
const fs = require("fs");

async function main() {
  const app = await dasha.deploy("./app");

  app.ttsDispatcher = () => "dasha";

  app.connectionProvider = async (conv) =>
    conv.input.channel === "chat"
      ? dasha.chat.connect(await dasha.chat.createConsoleChat())
      : dasha.sip.connect(new dasha.sip.Endpoint("default"));

  app.setExternal("transfer_money", async ({ amount, source, target }) => {
    try {
      amount = Number.parseInt(amount);
      let source_account = user.userAccounts.find(account => account.name === source.name);
      if (source_account === undefined) {
        throw new Error(JSON.stringify(source));
      }
      if (amount > source_account.balance) {
        return false;
      }
      let target_account = user.userAccounts.find(account => account.name === target.name);
      if (target_account === undefined) {
        target_account = user.bankAccounts.find(account => account.name === target.name);
        if (target_account === undefined) {
          throw new Error(JSON.stringify(target));
        }
      }
      source_account.balance -= amount;
      target_account.balance += amount;
      console.log(user);
      return true;
    } catch (e) {
      console.log({ resolve_target_account_err: e.message, args: args });
      return false;
    }
  });

  app.setExternal("resolve_source_account", async ({ account }) => {
    try {
      console.log({ resolve_source_account_args: JSON.stringify(account) });

      let source_account = user.userAccounts.find((acc) => {
        return account === acc.name || account.replace(/ /g, "") === acc.num.replace(/ /g, "")
      });
      if (source_account !== undefined) {
        return source_account;
      }
      throw new Error(JSON.stringify(account));

    } catch (e) {
      console.log({ resolve_source_account_err: e.message });
      return undefined;
    }
  });

  app.setExternal("resolve_target_account", async ({ account }) => {
    try {
      console.log({ resolve_target_account_args: JSON.stringify(account) });

      let target_account = user.userAccounts.find((acc) => {
        return account === acc.name || account === acc.num.replace(/ /g, "")
      });
      if (target_account !== undefined) {
        return target_account;
      }

      target_account = user.bankAccounts.find((acc) => {
        return account === acc.name || account === acc.num.replace(/ /g, "")
      });
      if (target_account !== undefined) {
        return target_account;
      }

      throw new Error(JSON.stringify(account));

    } catch (e) {
      console.log({ resolve_target_account_err: e.message });
      return undefined;
    }
  });


  const channel = process.argv[2];
  const user_id = process.argv[3];
  const users_db = require('./users_db.json')
  let user = undefined;
  if (channel == "chat") {
    user = users_db.find(user => user.id === user_id);
    if (user == undefined)
      console.error(`Can not find user for ${user_id} id`);
  }
  else {
    let phone = channel;
    user = users_db.find(user => user.phone === phone);
    if (user == undefined)
      console.error(`Can not find user for ${phone}`);
  }
  console.log(user);


  await app.start();

  const conv = app.createConversation({
    channel: channel,
      phone: user.phone,
      userAccounts: user.userAccounts,
      bankAccounts: user.bankAccounts
  });

  if (conv.input.channel !== "chat") conv.on("transcription", console.log);

  const logFile = await fs.promises.open("./log.txt", "w");
  await logFile.appendFile("#".repeat(100) + "\n");

  conv.on("transcription", async (entry) => {
    await logFile.appendFile(`${entry.speaker}: ${entry.text}\n`);
  });

  conv.on("debugLog", async (event) => {
    if (event?.msg?.msgId === "RecognizedSpeechMessage") {
      const logEntry = event?.msg?.results[0]?.facts;
      await logFile.appendFile(JSON.stringify(logEntry, undefined, 2) + "\n");
    }
  });

  const result = await conv.execute();
  console.log(result.output);

  await app.stop();
  app.dispose();

  await logFile.close();
}

main();
