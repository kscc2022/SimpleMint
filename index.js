const USUAL_NFT_ABI = [
  {"constant": true, "inputs":[],"name":"cost","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"constant": true, "inputs":[],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"},
];

const version = "v0.0.1";

let rpc_url = ""
let wallet_address = "";
let private_key = "";
let token_address = "";
let gas_price_of_input = "";
let gas_price_multiplier = "";
let gas_price_limit = "";
let web3;
let turned_on_switch = false;
let executing = false;
let status_messages = [];
let need_amount = 0;
let minted_amount = 0;
let duration = 1000;

window.onload = function() {
  update_user_data_from_input();
  document.getElementById('version').innerText = version;
  setTimeout(mint_if_needed, duration);
}

function update_user_data_from_input() {
  wallet_address = document.getElementById('wallet_address').value;
  token_address = document.getElementById('token_address').value;
  private_key = document.getElementById('private_key').value;
  rpc_url = document.getElementById('rpc_url').value;
  need_amount = parseInt(document.getElementById('need_amount').value);
  duration = parseInt(document.getElementById('duration').value);
  gas_price_of_input = document.getElementById('gas_price').value;
  gas_price_multiplier = parseInt(document.getElementById('gas_price_multiplier').value);
  gas_price_limit = parseInt(document.getElementById('gas_price_limit').value);
  web3 = new Web3(new Web3.providers.HttpProvider(rpc_url));
}

function filled_inputs() {
  return wallet_address && token_address && private_key && rpc_url;
}

function get_contract_of(address) {
  const token_abi = USUAL_NFT_ABI;
  const contract = new web3.eth.Contract(token_abi, address);
  return contract;
}

async function get_balance_of() {
  const contract = get_contract_of(token_address);
  const balance = await contract.methods.balanceOf(wallet_address).call();
  return balance;
}

async function mint(amount) {
  const contract = get_contract_of(token_address);
  const data = await contract.methods.mint().encodeABI(); // TODO: batchMint のようなメソッドがあるなら利用する
  let tx = await get_tx_of(data);
  const gas = await web3.eth.estimateGas(tx);
  tx['gas'] = gas;
  const tx_hash = await send_signed_tx(tx);
  update_status("TX SUCCEEDED");
  minted_amount += 1;
  executing = false;
}

async function get_tx_of(data) {
  const nonce = await web3.eth.getTransactionCount(wallet_address);
  let gas_price = await web3.eth.getGasPrice();
  if (gas_price_of_input != "auto" && parseInt(gas_price_of_input) > 0) {
    gas_price = await web3.utils.toWei(String(gas_price_of_input), "gwei");
  }

  if (gas_price_multiplier > 0) {
    gas_price = parseInt(gas_price * gas_price_multiplier / 100) ;
  }

  if (gas_price_limit > 0) {
    const gas_price_limit_wei = await web3.utils.toWei(String(gas_price_limit), "gwei");
    if (gas_price > gas_price_limit_wei) {
      gas_price = gas_price_limit_wei;
    }
  }
  update_status("Gas Price is " + gas_price);

  const tx = {
    'from': wallet_address,
    'to': token_address,
    'nonce': nonce,
    'value': 0, // TODO: cost を contract から自動取得する
    'gas': 0,
    'data': data,
    'gasPrice': gas_price,
  };
  return tx;
}

async function send_signed_tx(tx) {
  const signed_tx = await web3.eth.accounts.signTransaction(tx, private_key);
  const tx_hash = await web3.eth.sendSignedTransaction(signed_tx.rawTransaction);
  console.log(tx_hash);
  update_status('SEND TX:' + tx_hash["transactionHash"]);
  return tx_hash;
}

function toggle_bot_switch() {
  turned_on_switch = !turned_on_switch;

  update_user_data_from_input();
  if (!filled_inputs()) {
    alert("Please fill all inputs.");
    turned_on_switch = false;
  }

  const button_text = turned_on_switch ? "On" : "Off";
  document.getElementById('toggle_button').innerText = button_text;
  const inputs = document.getElementsByTagName('input');
  if (turned_on_switch) {
    for (const input of inputs) {
      input.setAttribute("disabled", "disabled");
    }
  } else {
    for (const input of inputs) {
      input.removeAttribute("disabled");
    }
  }
}

async function mint_if_needed() {
  try {
    if (turned_on_switch && !executing) {
      if (need_amount > 0 && need_amount > minted_amount) {
        executing = true;
        update_status("TRY TO MINT");
        await mint(1); // TODO: batchMint の仕組みがあれば利用する
      } else {
        update_status("MINTED NFTs YOU NEEDED");
      }
    }
  } catch(e) {
    console.log(e);
    update_status("FAILED: " + e);
    executing = false;
  }

  setTimeout(mint_if_needed, duration);
}

function update_status(message) {
  const message_with_date = new Date() + ": " + message;
  console.log(message_with_date);

  status_messages.unshift(message_with_date);
  let merged_message = "";

  const max_count = 30;
  if (status_messages.length > max_count) {
    status_messages.pop();
  }

  for (const status_message of status_messages) {
    merged_message += "<p>" + status_message + "</p>";
  }

  document.getElementById('status_message').innerHTML = merged_message;
}
