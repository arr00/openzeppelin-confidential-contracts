---
'openzeppelin-confidential-contracts': minor
---

`ERC7984ERC20Wrapper`: Allow extensions to attach 12 bytes of `metadata` to an unwrap request, packed alongside the recipient in storage. Added the `_unwrap(address,address,euint64,bytes12)` overload, the `unwrapMetadata` getter, and the `_afterUnwrapFinalized` hook.
