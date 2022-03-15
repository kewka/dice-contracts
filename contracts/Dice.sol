// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract Dice {
    uint256 public constant MIN_BET = 0.00000001 ether;
    uint8 public constant MIN_PLAYERS = 2;
    uint8 public constant MAX_PLAYERS = 6;

    uint8 public constant MIN_RESULT = 1;
    uint8 public constant MAX_RESULT = 6;

    uint256 public gameId;

    struct Game {
        uint256 bet;
        uint8 playerCount;
        address[MAX_PLAYERS] players;
        uint8[MAX_PLAYERS] results;
    }

    mapping(uint256 => Game) public games;

    event GameCreated(uint256 id);
    event GameFinished(uint256 id, uint8[MAX_PLAYERS] results);
    event PlayerJoined(uint256 id, address player);

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
        emit GameCreated(gameId);
    }

    function calculatePayouts(
        uint8[MAX_PLAYERS] memory _results,
        uint8 playerCount,
        uint256 bet
    ) external pure returns (uint256[MAX_PLAYERS] memory _payouts) {
        uint8 min = MAX_RESULT + 1;
        uint8 max = MIN_RESULT - 1;

        for (uint8 p = 0; p < playerCount; p++) {
            uint8 res = _results[p];

            if (res > max) {
                max = res;
            }

            if (res < min) {
                min = res;
            }
        }

        // Tie.
        if (min == max) {
            for (uint8 p = 0; p < playerCount; p++) {
                _payouts[p] = bet;
            }
            return _payouts;
        }

        uint8 winners = 0;
        uint256 totalBetAmount = bet * playerCount;

        for (uint8 p = 0; p < playerCount; p++) {
            if (_results[p] == max) {
                winners++;
            }
        }

        for (uint8 p = 0; p < playerCount; p++) {
            if (_results[p] == max) {
                _payouts[p] = totalBetAmount / winners;
            }
        }
    }

    function join(uint256 _gameId) external payable {
        Game storage game = games[_gameId];
        uint8 playerCount = game.playerCount;

        require(msg.value == game.bet, "Invalid bet amount");

        for (uint8 i = 0; i < playerCount; i++) {
            address player = game.players[i];

            if (player == address(0)) {
                game.players[i] = msg.sender;
                emit PlayerJoined(_gameId, msg.sender);

                if (i == playerCount - 1) {
                    for (uint8 p = 0; p < playerCount; p++) {
                        game.results[p] = randomResult(_gameId, p);
                    }

                    uint256[MAX_PLAYERS] memory payouts = this.calculatePayouts(
                        game.results,
                        playerCount,
                        game.bet
                    );

                    for (uint8 p = 0; p < playerCount; p++) {
                        uint256 value = payouts[p];
                        if (value > 0) {
                            (bool success, ) = payable(game.players[p]).call{
                                value: value
                            }("");
                            require(success, "Failed to send payouts");
                        }
                    }

                    emit GameFinished(_gameId, game.results);
                }

                return;
            }

            require(player != msg.sender, "You have already joined the game");
        }

        revert("Game is not available");
    }

    function randomResult(uint256 _gameId, uint8 playerIndex) internal view returns (uint8) {
        // TODO: not production ready :(
        return
            uint8(
                (uint256(
                    keccak256(
                        abi.encodePacked(
                            _gameId,
                            playerIndex,
                            msg.sender,
                            block.number,
                            blockhash(block.number),
                            block.timestamp,
                            block.difficulty,
                            block.coinbase
                        )
                    )
                ) % MAX_RESULT) + MIN_RESULT
            );
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
