import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { makeCommonEnvironment } from "@ubeswap/hardhat-celo";
import { expect } from "chai";
import { Signer } from "ethers/lib/ethers";
import { parseEther } from "ethers/lib/utils";
import hre from "hardhat";
import {
  TestToken,
  TestToken__factory,
  TokenAllocator,
  TokenAllocator__factory,
} from "../build/types/";
import { F2POOL, POLYCHAIN, VITALIK, ZERO } from "./utils/addresses";

describe("TokenAllocator", () => {
  let deployer: Signer;
  let ube: TestToken;
  let allocator: TokenAllocator;

  beforeEach(async () => {
    const { signer } = await makeCommonEnvironment(hre);
    deployer = signer;

    // deploy manager
    const tokenFactory = new TestToken__factory(signer);
    ube = await tokenFactory.deploy("Ubeswap", "UBE");

    allocator = await new TokenAllocator__factory(deployer).deploy(
      "TokenAllocator",
      "TA",
      0,
      await signer.getAddress(),
      ube.address
    );
  });

  describe("#addBeneficiary", () => {
    it("only owner", async () => {
      const [_, signer2] = await hre.ethers.getSigners();
      await expect(
        allocator
          .connect(signer2!)
          .addBeneficiary(await signer2!.getAddress(), 10)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("must have >0 shares", async () => {
      await expect(
        allocator.addBeneficiary(await deployer.getAddress(), 0)
      ).to.be.revertedWith("TokenAllocator: shares must be greater than 0");
    });

    it("must not be locked", async () => {
      await ube.transfer(allocator.address, parseEther("10"));
      await allocator.addBeneficiary(
        await deployer.getAddress(),
        parseEther("10")
      );
      await allocator.lockBeneficiaries();

      await expect(allocator.addBeneficiary(VITALIK, 10)).to.be.revertedWith(
        "TokenAllocator: beneficiaries are locked"
      );
    });

    it("cannot have duplicate beneficiaries", async () => {
      await allocator.addBeneficiary(
        await deployer.getAddress(),
        parseEther("10")
      );
      await expect(
        allocator.addBeneficiary(await deployer.getAddress(), parseEther("20"))
      ).to.be.revertedWith("TokenAllocator: beneficiary already added");
    });

    it("can add multiple beneficiaries", async () => {
      await expect(allocator.addBeneficiary(POLYCHAIN, parseEther("10")))
        .to.emit(allocator, "BeneficiaryAdded")
        .withArgs(POLYCHAIN, parseEther("10"));
      await expect(allocator.addBeneficiary(VITALIK, parseEther("20")))
        .to.emit(allocator, "BeneficiaryAdded")
        .withArgs(VITALIK, parseEther("20"));
      await expect(allocator.addBeneficiary(F2POOL, parseEther("30")))
        .to.emit(allocator, "BeneficiaryAdded")
        .withArgs(F2POOL, parseEther("30"));
      await expect(allocator.lockBeneficiaries())
        .to.emit(allocator, "BeneficiariesLocked")
        .withArgs()
        .and.to.emit(allocator, "OwnershipTransferred")
        .withArgs(await deployer.getAddress(), ZERO);

      expect(await allocator.balanceOf(POLYCHAIN)).to.equal(parseEther("10"));
      expect(await allocator.balanceOf(VITALIK)).to.equal(parseEther("20"));
      expect(await allocator.balanceOf(F2POOL)).to.equal(parseEther("30"));
    });
  });

  describe("#redeem", async () => {
    let benA: SignerWithAddress;
    let benB: SignerWithAddress;

    let benAAllocator: TokenAllocator;
    let benBAllocator: TokenAllocator;

    beforeEach(async () => {
      const signers = await hre.ethers.getSigners();
      benA = signers[1]!;
      benB = signers[2]!;

      benAAllocator = TokenAllocator__factory.connect(allocator.address, benA);
      benBAllocator = TokenAllocator__factory.connect(allocator.address, benB);

      await expect(allocator.addBeneficiary(benA.address, parseEther("10")))
        .to.emit(allocator, "BeneficiaryAdded")
        .withArgs(benA.address, parseEther("10"));
      await expect(allocator.addBeneficiary(benB.address, parseEther("20")))
        .to.emit(allocator, "BeneficiaryAdded")
        .withArgs(benB.address, parseEther("20"));
      await expect(allocator.addBeneficiary(F2POOL, parseEther("30")))
        .to.emit(allocator, "BeneficiaryAdded")
        .withArgs(F2POOL, parseEther("30"));
    });

    const lock = async () => {
      await expect(allocator.lockBeneficiaries())
        .to.emit(allocator, "BeneficiariesLocked")
        .withArgs()
        .and.to.emit(allocator, "OwnershipTransferred")
        .withArgs(await deployer.getAddress(), ZERO);
    };

    it("works", async () => {
      await lock();
      const checkBalances = async (
        totalTokensReceived: string,
        balanceAfterLastRedemption: string
      ) => {
        expect(await allocator.totalTokensReceived()).to.equal(
          parseEther(totalTokensReceived)
        );
        expect(await allocator.balanceAfterLastRedemption()).to.equal(
          parseEther(balanceAfterLastRedemption)
        );
      };

      await ube.transfer(allocator.address, parseEther("600"));
      await checkBalances("0", "0");

      // redeem for self
      expect(await benAAllocator.earned(benA.address)).to.equal(
        parseEther("100")
      );
      await expect(benAAllocator.getReward())
        .to.emit(allocator, "Redeemed")
        .withArgs(benA.address, parseEther("100"))
        .and.to.emit(ube, "Transfer")
        .withArgs(allocator.address, benA.address, parseEther("100"));

      expect(await ube.balanceOf(benA.address)).to.equal(parseEther("100"));
      expect(await ube.balanceOf(allocator.address)).to.equal(
        parseEther("500")
      );

      // 1 * 600 - 1 * 100
      await checkBalances("600", "500");

      // add 600 more tokens of rewards (total 1200)
      await ube.transfer(allocator.address, parseEther("600"));

      // redeem 2
      await expect(benBAllocator.getReward())
        .to.emit(allocator, "Redeemed")
        .withArgs(benB.address, parseEther("400"))
        .and.to.emit(ube, "Transfer")
        .withArgs(allocator.address, benB.address, parseEther("400"));
      expect(await ube.balanceOf(benB.address)).to.equal(parseEther("400"));
      expect(await ube.balanceOf(allocator.address)).to.equal(
        parseEther("700")
      );

      // 2 * 600 - (2 * 200 + 1 * 100)
      await checkBalances("1200", "700");
    });

    it("must be locked", async () => {
      await expect(benAAllocator.getReward()).to.be.revertedWith(
        "TokenAllocator: beneficiaries must be locked"
      );
    });

    it("must be a beneficiary", async () => {
      await lock();
      const signers = await hre.ethers.getSigners();
      const rando = signers[3]!;
      await expect(
        TokenAllocator__factory.connect(allocator.address, rando).getReward()
      ).to.be.revertedWith("TokenAllocator: not a beneficiary");
    });

    it("redeem 0 does nothing", async () => {
      await lock();
      await expect(benAAllocator.getReward()).to.not.emit(
        benAAllocator,
        "Redeemed"
      );
    });

    it("redeem twice -- second time does nothing", async () => {
      await lock();
      await ube.transfer(allocator.address, parseEther("600"));

      await expect(benAAllocator.getReward())
        .to.emit(allocator, "Redeemed")
        .withArgs(benA.address, parseEther("100"))
        .and.to.emit(ube, "Transfer")
        .withArgs(allocator.address, benA.address, parseEther("100"));

      await expect(benAAllocator.getReward()).to.not.emit(
        benAAllocator,
        "Redeemed"
      );
    });
  });
});
