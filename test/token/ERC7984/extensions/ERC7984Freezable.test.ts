import { IACL__factory } from '../../../../types';
import { $ERC7984FreezableMock } from '../../../../types/contracts-exposed/mocks/token/ERC7984/extensions/ERC7984FreezableMock.sol/$ERC7984FreezableMock';
import { getAclAddress } from '../../../helpers/accounts';
import { shouldBehaveLikeERC7984 } from '../ERC7984.behavior';
import { FhevmType } from '@fhevm/hardhat-plugin';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { EventLog } from 'ethers';
import { ethers, fhevm } from 'hardhat';

const name = 'ConfidentialFungibleToken';
const symbol = 'CFT';
const uri = 'https://example.com/metadata';

describe('ERC7984Freezable', function () {
  beforeEach(async function () {
    const accounts = await ethers.getSigners();
    [this.holder, this.recipient, this.freezer, this.operator, this.anyone] = accounts;

    this.token = (await ethers.deployContract('$ERC7984FreezableMock', [
      name,
      symbol,
      uri,
    ])) as any as $ERC7984FreezableMock;
    this.acl = IACL__factory.connect(await getAclAddress(), ethers.provider);
  });

  describe('should behave like ERC7984', function () {
    shouldBehaveLikeERC7984(name, symbol, uri, 6, {});
  });

  describe('freezing', function () {
    beforeEach(async function () {
      await this.token['$_mint(address,uint64)'](this.recipient, 1000);
    });

    it(`should set and get confidential frozen`, async function () {
      const { token, acl, recipient } = this;

      const amount = 100;

      await expect(token['$_setConfidentialFrozen(address,uint64)'](recipient.address, amount))
        .to.emit(token, 'TokensFrozen')
        .withArgs(recipient.address, anyValue);

      const frozenHandle = await token.confidentialFrozen(recipient.address);
      await expect(acl.isAllowed(frozenHandle, recipient.address)).to.eventually.be.true;
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, frozenHandle, await token.getAddress(), recipient),
      ).to.eventually.equal(amount);
      const balanceHandle = await token.confidentialBalanceOf(recipient.address);
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, balanceHandle, await token.getAddress(), recipient),
      ).to.eventually.equal(1000);
      const confidentialAvailableArgs = recipient.address;
      const availableHandle = await token.confidentialAvailable.staticCall(confidentialAvailableArgs);
      await (token as any).connect(recipient).confidentialAvailableAccess(confidentialAvailableArgs);
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, availableHandle, await token.getAddress(), recipient),
      ).to.eventually.equal(1000 - amount);
    });

    it('should transfer max available', async function () {
      const { token, recipient, anyone } = this;

      await token['$_setConfidentialFrozen(address,uint64)'](recipient.address, 100);
      const confidentialAvailableArgs = recipient.address;
      const availableHandle = await token.confidentialAvailable.staticCall(confidentialAvailableArgs);
      await (token as any).connect(recipient).confidentialAvailableAccess(confidentialAvailableArgs);
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, availableHandle, await token.getAddress(), recipient),
      ).to.eventually.equal(900);
      const encryptedInput2 = await fhevm
        .createEncryptedInput(await token.getAddress(), recipient.address)
        .add64(900)
        .encrypt();
      await token
        .connect(recipient)
        ['confidentialTransfer(address,bytes32,bytes)'](
          anyone.address,
          encryptedInput2.handles[0],
          encryptedInput2.inputProof,
        );
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint64,
          await token.confidentialBalanceOf(recipient.address),
          await token.getAddress(),
          recipient,
        ),
      ).to.eventually.equal(100);
    });

    it('should transfer zero if transferring more than available', async function () {
      const { token, recipient, anyone } = this;

      await token['$_setConfidentialFrozen(address,uint64)'](recipient.address, 500);
      const encryptedInput2 = await fhevm
        .createEncryptedInput(await token.getAddress(), recipient.address)
        .add64(501)
        .encrypt();
      const tx = await token
        .connect(recipient)
        ['confidentialTransfer(address,bytes32,bytes)'](
          anyone.address,
          encryptedInput2.handles[0],
          encryptedInput2.inputProof,
        );
      await expect(tx).to.emit(token, 'ConfidentialTransfer');
      const transferEvent = (await tx
        .wait()
        .then(receipt => receipt!.logs.filter((log: any) => log.address === token.target)[0])) as EventLog;
      expect(transferEvent.args[0]).to.equal(recipient.address);
      expect(transferEvent.args[1]).to.equal(anyone.address);
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, transferEvent.args[2], await token.getAddress(), recipient),
      ).to.eventually.equal(0);
      // recipient balance is unchanged
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint64,
          await token.confidentialBalanceOf(recipient.address),
          await token.getAddress(),
          recipient,
        ),
      ).to.eventually.equal(1000);
    });
  });
});
