import { FhevmType } from '@fhevm/hardhat-plugin';
import { expect } from 'chai';
import { ethers, fhevm } from 'hardhat';

const name = 'ConfidentialFungibleToken';
const symbol = 'CFT';
const uri = 'https://example.com/metadata';

describe.only('ACLTest', function () {
  beforeEach(async function () {
    const accounts = await ethers.getSigners();
    const [holder, recipient, operator] = accounts;

    const token = await ethers.deployContract('$ERC7984Mock', [name, symbol, uri]);
    const aclTest = await ethers.deployContract('ACLTest', [token.target]);
    this.accounts = accounts.slice(3);
    this.holder = holder;
    this.recipient = recipient;
    this.token = token;
    this.operator = operator;
    this.aclTest = aclTest;

    await this.token['$_mint(address,uint64)'](aclTest.target, 1000);
  });

  it('temp test', async function () {
    const encryptedInput = await fhevm
      .createEncryptedInput(this.token.target, this.aclTest.target)
      .add64(400)
      .encrypt();

    const tx = await this.aclTest
      .connect(this.holder)
      .sendVal(encryptedInput.handles[0], encryptedInput.inputProof, this.holder);
    const receipt = await tx.wait();

    const transferredHandle = receipt.logs.filter((log: any) => log.address === this.token.target)[0].topics[3];

    await expect(
      fhevm.userDecryptEuint(FhevmType.euint64, transferredHandle, this.token.target, this.holder),
    ).to.eventually.equal(400);
  });
});
