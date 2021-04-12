# Ubeswap Farming

Contracts for distributing Ube rewards.

## Deployment

`<network>` is either `alfajores` or `mainnet`.

```sh
yarn hardhat deploy --network alfajores --step pool-manager
yarn hardhat deploy --network alfajores --step distribution
yarn hardhat deploy --network alfajores --step create-pools
yarn hardhat deploy --network alfajores --step start-farming
```

## License

MIT
