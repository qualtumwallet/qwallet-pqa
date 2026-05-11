import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("QualtumModule", (m) => {
  const qualtum = m.contract("Qualtum");

  return { qualtum };
});