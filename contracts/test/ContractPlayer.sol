// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../Dice.sol";

contract ContractPlayer {
    Dice private dice;

    constructor(Dice _dice) {
        dice = _dice;
    }

    function join(uint256 _gameId) external payable {
        dice.join{value: msg.value}(_gameId);
    }

    function create(uint8 playerCount) external payable {
        dice.create{value: msg.value}(playerCount);
    }

    receive() external payable {
        while (true) {}
    }
}
