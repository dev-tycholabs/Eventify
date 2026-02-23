require("@nomicfoundation/hardhat-toolbox");
require("hardhat-preprocessor");
require("dotenv").config();
const fs = require('fs')


//Example of how to use environment variables
// const INFURA_API_KEY_POLYGON_MUMBAI = process.env.INFURA_API_KEY_POLYGON_MUMBAI;
// const INFURA_API_KEY_LINEA_GOERLI = process.env.INFURA_API_KEY_LINEA_GOERLI;
// const INFURA_API_KEY_BASE_GOERLI = process.env.INFURA_API_KEY_BASE_GOERLI;
// const INFURA_API_KEY_ETHEREUM_SEPOLIA =
//   process.env.INFURA_API_KEY_ETHEREUM_SEPOLIA;
// const INFURA_API_KEY_AURORA_TESTNET = process.env.INFURA_API_KEY_AURORA_TESTNET;
// const INFURA_API_KEY_AVALANCHE_FIJI = process.env.INFURA_API_KEY_AVALANCHE_FUJI;
// const INFURA_API_KEY_CELO_ALFAJORES = process.env.INFURA_API_KEY_CELO_ALFAJORES;
// const INFURA_API_KEY_OPTIMISIM_GOERLI =
//   process.env.INFURA_API_KEY_OPTIMISIM_GOERLI;
// const INFURA_API_KEY_ARBITRUM_GOERLI =
//   process.env.INFURA_API_KEY_ARBITRUM_GOERLI;
// const PRIVATE_KEY = process.env.PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
      compilers: [
        { 
            version: '0.8.25',
            settings: {
              viaIR: true,
              optimizer: {
                enabled: true,
                runs: 200,
              },
            }
          }
      ]
    },
  networks: {
    hardhat: {},
    // Etherlink Testnet (Shadownet)
    etherlinkTestnet: {
      url: "https://node.shadownet.etherlink.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 127823,
      timeout: 60000,
    },
    // Ethereum Sepolia Testnet
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 11155111,
      timeout: 60000,
    },
    // Avalanche Fuji Testnet
    avalancheFuji: {
      url: "https://avalanche-fuji.drpc.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 43113,
      timeout: 60000,
    },
    // Polygon Amoy Testnet
    polygonAmoy: {
      url: "https://rpc-amoy.polygon.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 80002,
      timeout: 60000,
    },
    // Base Sepolia Testnet
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 84532,
      timeout: 60000,
    },
    // Optimism Sepolia Testnet
    optimismSepolia: {
      url: "https://sepolia.optimism.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 11155420,
      timeout: 60000,
    },
    // Unichain Sepolia Testnet
    unichainSepolia: {
      url: "https://sepolia.unichain.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 1301,
      timeout: 60000,
    },
    // Etherlink Mainnet
    etherlink: {
      url: "https://node.mainnet.etherlink.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42793,
    },
    // metisAndromeda: {
    //   url: "https://andromeda.metis.io/?owner=1088",
    //   accounts: [process.env.WALLET_PRIVATE_KEY],
    //   verify: {
    //     etherscan: {
    //       apiKey: "apiKey is not required, just set a placeholder",
    //       apiUrl:
    //         "https://api.routescan.io/v2/network/mainnet/evm/1088/etherscan",
    //     },
    //   },
    // },
    // ethereumSepolia: {
    //   url: `https://eth-sepolia.g.alchemy.com/v2/${INFURA_API_KEY_ETHEREUM_SEPOLIA}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // polygonMumbai: {
    //   url: `https://polygon-mumbai.infura.io/v3/${INFURA_API_KEY_POLYGON_MUMBAI}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // lineaGoerli: {
    //   url: `https://linea-goerli.infura.io/v3/${INFURA_API_KEY_LINEA_GOERLI}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // baseGoerli: {
    //   url: `https://base-goerli.infura.io/v3/${INFURA_API_KEY_BASE_GOERLI}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // arbitrumGoerli: {
    //   url: `https://base-goerli.infura.io/v3/${INFURA_API_KEY_ARBITRUM_GOERLI}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // auroraTestnet: {
    //   url: `https://base-goerli.infura.io/v3/${INFURA_API_KEY_AURORA_TESTNET}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // avalancheFiji: {
    //   url: `https://base-goerli.infura.io/v3/${INFURA_API_KEY_AVALANCHE_FIJI}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // avalancheFiji: {
    //   url: `https://base-goerli.infura.io/v3/${INFURA_API_KEY_AVALANCHE_FUJI}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // celoAlfajores: {
    //   url: `https://base-goerli.infura.io/v3/${INFURA_API_KEY_CELO_ALFAJORES}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // celoAlfajores: {
    //   url: `https://base-goerli.infura.io/v3/${INFURA_API_KEY_CELO_ALFAJORES}`,
    //   accounts: [PRIVATE_KEY],
    // },
    // optimisimGoerli: {
    //   url: `https://optimism-goerli.infura.io/v3/${INFURA_API_KEY_OPTIMISIM_GOERLI}`,
    //   accounts: [PRIVATE_KEY],
    // },
  },
}
