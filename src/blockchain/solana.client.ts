import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, clusterApiUrl ,PublicKey} from "@solana/web3.js";
import bs58 from "bs58";

import { serverConfig } from "../config";
import idl from "../idl/breezo.json";

export class SolanaClient {
  connection: Connection;
  wallet: Wallet;
  provider: AnchorProvider;
  program: Program;

  constructor() {
    this.connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const keypair = Keypair.fromSecretKey(bs58.decode(serverConfig.BACKEND_AUTHORITY_PRIVATE_KEY));
    this.wallet = new Wallet(keypair);

    this.provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: "confirmed",
    });

    this.program = new Program(
  idl as any,
  new PublicKey(idl.metadata.address),
  this.provider
);

  }
}
