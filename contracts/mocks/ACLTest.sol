// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "../interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Impl} from "@fhevm/solidity/lib/Impl.sol";

contract ACLTest is ZamaEthereumConfig {
    IERC7984 public token;

    constructor(IERC7984 token_) {
        token = token_;
    }

    function sendVal(externalEuint64 val, bytes memory inputProof, address recipient) public {
        token.confidentialTransfer(recipient, val, inputProof);
    }
}
