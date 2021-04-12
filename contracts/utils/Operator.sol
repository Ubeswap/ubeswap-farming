// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "../openzeppelin-solidity/contracts/Ownable.sol";

/**
 * Operator allows for a second address to "operate" on various functions.
 * This is useful for having emergency non-timelock functions be available.
 */
contract Operator is Ownable {
    address public operator;

    constructor(address owner_, address operator_) {
        setOperator(operator_);
        transferOwnership(owner_);
    }

    function setOperator(address _operator) public onlyOwner {
        address oldOperator = operator;
        operator = _operator;
        emit OperatorTransferred(oldOperator, operator);
    }

    event OperatorTransferred(address oldOperator, address newOperator);

    modifier onlyOperator {
        require(msg.sender == operator, "Operator: must be operator");
        _;
    }
}
