import { Signer, Contract, ContractFactory } from "ethers";
import { linkLibraries } from "../util/linkLibraries";
import WETH9 from "../util/WETH9.json";

type ContractJson = { abi: any; bytecode: string };
const artifacts: { [name: string]: ContractJson } = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
  WETH9,
};

// TODO: Should replace these with the proper typechain output.
// type INonfungiblePositionManager = Contract;
// type IUniswapV3Factory = Contract;

export class UniswapV3Deployer {
  static async deploy(actor: Signer): Promise<{ [name: string]: Contract }> {
    const deployer = new UniswapV3Deployer(actor);

    const factory = await deployer.deployFactory();
    const router = await deployer.deployRouter(factory.address, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c");
    const nftDescriptorLibrary = await deployer.deployNFTDescriptorLibrary();
    const positionDescriptor = await deployer.deployPositionDescriptor(
      nftDescriptorLibrary.address,
      "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"
    );
    const positionManager = await deployer.deployNonfungiblePositionManager(
      factory.address,
      "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      positionDescriptor.address
    );

    return {
      factory,
      router,
      nftDescriptorLibrary,
      positionDescriptor,
      positionManager,
    };
  }

  deployer: Signer;

  constructor(deployer: Signer) {
    this.deployer = deployer;
  }

  async deployFactory() {
    return await this.deployContract<Contract>(
      artifacts.UniswapV3Factory.abi,
      artifacts.UniswapV3Factory.bytecode,
      [],
      this.deployer
    );
  }

  async deployRouter(factoryAddress: string, weth9Address: string) {
    return await this.deployContract<Contract>(
      artifacts.SwapRouter.abi,
      artifacts.SwapRouter.bytecode,
      [factoryAddress, weth9Address],
      this.deployer
    );
  }

  async deployNFTDescriptorLibrary() {
    return await this.deployContract<Contract>(
      artifacts.NFTDescriptor.abi,
      artifacts.NFTDescriptor.bytecode,
      [],
      this.deployer
    );
  }

  async deployPositionDescriptor(
    nftDescriptorLibraryAddress: string,
    weth9Address: string
  ) {
    const linkedBytecode = linkLibraries(
      {
        bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
        linkReferences: {
          "NFTDescriptor.sol": {
            NFTDescriptor: [
              {
                length: 20,
                start: 1261,
              },
            ],
          },
        },
      },
      {
        NFTDescriptor: nftDescriptorLibraryAddress,
      }
    );

    return (await this.deployContract(
      artifacts.NonfungibleTokenPositionDescriptor.abi,
      linkedBytecode,
      [weth9Address],
      this.deployer
    )) as Contract;
  }

  async deployNonfungiblePositionManager(
    factoryAddress: string,
    weth9Address: string,
    positionDescriptorAddress: string
  ) {
    return await this.deployContract<Contract>(
      artifacts.NonfungiblePositionManager.abi,
      artifacts.NonfungiblePositionManager.bytecode,
      [factoryAddress, weth9Address, positionDescriptorAddress],
      this.deployer
    );
  }

  private async deployContract<T>(
    abi: any,
    bytecode: string,
    deployParams: Array<any>,
    actor: Signer
  ) {
    const factory = new ContractFactory(abi, bytecode, actor);
    return await factory.deploy(...deployParams);
  }
}
