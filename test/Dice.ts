import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Dice, ContractPlayer } from "../typechain";

describe("Dice", () => {
  let dice: Dice;
  let contractPlayer: ContractPlayer;
  let signers: SignerWithAddress[];

  beforeEach(async () => {
    const Dice = await ethers.getContractFactory("Dice");
    signers = await ethers.getSigners();
    dice = await Dice.deploy();
    await dice.deployed();

    const ContractPlayer = await ethers.getContractFactory("ContractPlayer");
    contractPlayer = await ContractPlayer.deploy(dice.address);
    await contractPlayer.deployed();
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
    it("onlyEOA", async () => {
      const bet = parseEther("1.0");
      const playerCount = 2;
      await expect(
        contractPlayer.create(playerCount, { value: bet })
      ).to.be.revertedWith("Caller is not an EOA");
    });

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

    it("Create New Game", async () => {
      const bet = parseEther("1.0");
      const playerCount = 2;

      expect(await ethers.provider.getBalance(dice.address)).to.be.equal(0);

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

  describe("calculatePayouts", () => {
    const testCases: Array<
      [
        results: [number, number, number, number, number, number],
        playerCount: number,
        bet: BigNumber,
        expected: [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish
        ]
      ]
    > = [
      [
        [1, 2, 0, 0, 0, 0],
        2,
        parseEther("0.1"),
        [0, parseEther("0.2"), 0, 0, 0, 0],
      ],
      [
        [3, 2, 0, 0, 0, 0],
        2,
        parseEther("0.1"),
        [parseEther("0.2"), 0, 0, 0, 0, 0],
      ],
      [
        [3, 3, 0, 0, 0, 0],
        2,
        parseEther("0.1"),
        [parseEther("0.1"), parseEther("0.1"), 0, 0, 0, 0],
      ],
      [
        [3, 3, 3, 3, 3, 3],
        6,
        parseEther("0.1"),
        [
          parseEther("0.1"),
          parseEther("0.1"),
          parseEther("0.1"),
          parseEther("0.1"),
          parseEther("0.1"),
          parseEther("0.1"),
        ],
      ],
      [
        [5, 5, 3, 3, 3, 3],
        6,
        parseEther("0.1"),
        [parseEther("0.3"), parseEther("0.3"), 0, 0, 0, 0],
      ],
      [
        [5, 5, 1, 2, 3, 5],
        6,
        parseEther("0.1"),
        [parseEther("0.2"), parseEther("0.2"), 0, 0, 0, parseEther("0.2")],
      ],
      [
        [6, 6, 6, 1, 1, 0],
        5,
        parseEther("1.25"),
        [
          BigNumber.from("0x1ce97ca0f2105555"),
          BigNumber.from("0x1ce97ca0f2105555"),
          BigNumber.from("0x1ce97ca0f2105555"),
          0,
          0,
          0,
        ],
      ],
    ];

    testCases.forEach(([results, playerCount, bet, expected], i) => {
      it(`#${i} ${JSON.stringify({
        results,
        playerCount,
        bet: bet.toString(),
      })}`, async () => {
        const payouts = await dice.calculatePayouts(results, playerCount, bet);
        expect(payouts).to.eql(expected.map(BigNumber.from));
      });
    });
  });

  describe("join", () => {
    it("onlyEOA", async () => {
      const bet = parseEther("1.0");
      const playerCount = 2;
      const tx = await dice.create(playerCount, { value: bet });
      await tx.wait();
      await expect(contractPlayer.join(1, { value: bet })).to.be.revertedWith(
        "Caller is not an EOA"
      );
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

    it("Game is not available", async () => {
      // not found
      await expect(dice.join(0)).to.be.revertedWith("Game is not available");

      // already over
      const bet = parseEther("1.0");
      const playerCount = 2;

      let tx = await dice.create(playerCount, { value: bet });
      await tx.wait();

      tx = await dice.connect(signers[1]).join(1, { value: bet });
      await tx.wait();

      await expect(
        dice.connect(signers[2]).join(1, { value: bet })
      ).to.be.revertedWith("Game is not available");
    });

    for (let playerCount = 2; playerCount <= 6; playerCount++) {
      it(`Finish Game (playersCount=${playerCount})`, async () => {
        const bet = parseEther("1.0");
        const players = [...Array(playerCount)].map((_, i) => signers[i]);

        const tx = await dice.connect(players[0]).create(playerCount, {
          value: bet,
        });

        await tx.wait();

        const balances = await Promise.all(
          players.map((player) => player.getBalance())
        );

        await Promise.all(
          players.map(async (player, i) => {
            // Creator
            if (i === 0) return;

            const tx = await dice.connect(player).join(1, {
              value: bet,
            });

            const receipt = await tx.wait();
            balances[i] = balances[i]
              .sub(receipt.gasUsed.mul(receipt.effectiveGasPrice))
              .sub(bet);
          })
        );

        const results = await dice.results(1);
        const payouts = await dice.calculatePayouts(results, playerCount, bet);

        const newBalances = await Promise.all(
          players.map((player) => player.getBalance())
        );

        balances.forEach((balance, i) => {
          expect(balance.add(payouts[i])).to.be.eq(newBalances[i]);
        });

        players.forEach((_, i) => {
          expect(results[i]).to.be.greaterThan(0);
        });
      });
    }
  });
});
