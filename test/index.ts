import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Dice } from "../typechain";

describe("Dice", function () {
  let dice: Dice;
  let signers: SignerWithAddress[];

  beforeEach(async () => {
    const Dice = await ethers.getContractFactory("Dice");
    signers = await ethers.getSigners();
    dice = await Dice.deploy();
    await dice.deployed();
  });

  it("MIN_BET", async () => {
    expect(await dice.MIN_BET()).to.be.equal(10_000_000_000);
  });

  it("MIN_PLAYERS", async () => {
    expect(await dice.MIN_PLAYERS()).to.be.equal(2);
  });

  it("MAX_PLAYERS", async () => {
    expect(await dice.MAX_PLAYERS()).to.be.equal(6);
  });

  it("gameId", async () => {
    expect(await dice.gameId()).to.be.equal(0);
  });

  describe("create", () => {
    describe("Invalid Player Count", () => {
      [0, 1, 7, 100].forEach((playerCount) => {
        it("playerCount: " + playerCount, async () => {
          await expect(
            dice.create(playerCount, { value: 10_000_000_000 })
          ).to.be.revertedWith("Invalid Player Count");
        });
      });
    });

    describe("Bet amount is too low", () => {
      [0, 10, 100, 500, 10_000_000_000 - 1].forEach((bet) => {
        it("bet: " + bet, async () => {
          await expect(dice.create(2, { value: bet })).to.be.revertedWith(
            "Bet amount is too low"
          );
        });
      });
    });

    it("creates a new game", async () => {
      const bet = parseEther("1.0");
      const playerCount = 2;

      const tx = await dice.create(playerCount, {
        value: bet,
      });
      await tx.wait();

      expect(await ethers.provider.getBalance(dice.address)).to.be.equal(bet);

      const gameId = await dice.gameId();
      expect(gameId).to.be.equal(1);

      const game = await dice.games(gameId);
      expect(game.playerCount).to.be.equal(playerCount);
      expect(game.bet).to.be.eq(bet);

      const gamePlayers = await dice.players(gameId);
      expect(gamePlayers).to.be.eql([
        signers[0].address,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ]);
      const gameResults = await dice.results(gameId);
      expect(gameResults).to.be.eql([0, 0, 0, 0, 0, 0]);
    });
  });

  describe("join", () => {
    it("Game not found", async () => {
      await expect(dice.join(0)).to.be.revertedWith("Game not found");
    });

    it("You have already joined the game", async () => {
      const bet = parseEther("1.0");
      const playerCount = 2;

      const tx = await dice.create(playerCount, { value: bet });
      await tx.wait();

      await expect(dice.join(1, { value: bet })).to.be.revertedWith(
        "You have already joined the game"
      );
    });

    it("Invalid bet amount", async () => {
      const bet = parseEther("1.0");
      const playerCount = 2;

      const tx = await dice.create(playerCount, { value: bet });
      await tx.wait();

      await expect(
        dice.connect(signers[1]).join(1, { value: 1000 })
      ).to.be.revertedWith("Invalid bet amount");
    });

    it("Game is already over", async () => {
      const bet = parseEther("1.0");
      const playerCount = 2;

      let tx = await dice.create(playerCount, { value: bet });
      await tx.wait();

      tx = await dice.connect(signers[1]).join(1, { value: bet });
      await tx.wait();

      await expect(
        dice.connect(signers[2]).join(1, { value: bet })
      ).to.be.revertedWith("Game is already over");
    });

    it("updates game.results", async () => {
      const bet = parseEther("1.0");
      const playerCount = 2;

      let tx = await dice.create(playerCount, { value: bet });
      await tx.wait();

      let results = await dice.results(1);
      expect(results[0]).to.be.equal(0);
      expect(results[1]).to.be.equal(0);

      tx = await dice.connect(signers[1]).join(1, { value: bet });
      await tx.wait();

      results = await dice.results(1);
      expect(results[0]).to.be.greaterThan(0);
      expect(results[1]).to.be.greaterThan(0);
    });
  });
});
