// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract Dice {
    uint256 public constant MIN_BET = 10_000_000_000;
    uint8 public constant MIN_PLAYERS = 2;
    uint8 public constant MAX_PLAYERS = 6;
    uint256 public gameId;

    struct Game {
        uint256 bet;
        uint8 playerCount;
        address[MAX_PLAYERS] players;
        uint8[MAX_PLAYERS] results;
    }

    mapping(uint256 => Game) public games;

    function create(uint8 playerCount) external payable {
        require(msg.value >= MIN_BET, "Bet amount is too low");
        require(
            playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS,
            "Invalid Player Count"
        );
        Game storage game = games[++gameId];
        game.bet = msg.value;
        game.playerCount = playerCount;
        game.players[0] = msg.sender;
    }

    function join(uint256 _gameId) external payable {
        Game storage game = games[_gameId];
        require(game.playerCount != 0, "Game not found");
        require(msg.value == game.bet, "Invalid bet amount");

        for (uint8 i = 0; i < game.playerCount; i++) {
            address player = game.players[i];

            if (player == address(0)) {
                game.players[i] = msg.sender;

                if (i == game.playerCount - 1) {
                    // TODO: randomize results
                    game.results = [1, 2, 3, 4, 5, 6];
                }

                return;
            }

            require(player != msg.sender, "You have already joined the game");
        }

        revert("Game is already over");
    }

    function results(uint256 _gameId)
        external
        view
        returns (uint8[MAX_PLAYERS] memory)
    {
        return games[_gameId].results;
    }

    function players(uint256 _gameId)
        external
        view
        returns (address[MAX_PLAYERS] memory)
    {
        return games[_gameId].players;
    }
}
