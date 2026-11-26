import type { ChurchGiving } from "./parse";

/**
 * SAMPLE giving details for the demo. The server does not send a church's giving details yet (Shalom's backend has no field for them),
 * so a TEST site (built with VITE_ALLOW_TEST_HOST=1, or a stub build) shows these for a church that has none, so the screen can be seen.
 * Everything here is made up and marked `sample: true`: the page says so. A real build never calls this.
 */
export function demoGiving(): ChurchGiving {
  return {
    link: "https://example.org/give",
    bank: {
      accountName: "Sample Church Trust",
      bankName: "Sample Bank",
      branch: "Main Branch",
      accountNumber: "0000 0000 0000",
      ifsc: "SAMP0000000",
      upi: "samplechurch@bank",
    },
    note: "Please write your name in the reference so the church can thank you.",
    sample: true,
  };
}
