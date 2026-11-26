# WebSaathi extension

Run `npm run sync:case`, then load the `extension/` folder through Chrome's **Load unpacked** option.

Start the shared practice sites with `npm run sites` and open the [seller order](http://localhost:5501/orders/MS-48213). Open the WebSaathi side panel and start a refund case. Open the seller support chat from the panel to capture the refund promise, then save the practice proof and open the practice helpline. Review each proposed fill and submit on the portal.

After the portal requests proof, open the saved docket status. WebSaathi reads the request in Hindi and prepares the reply. Choose the attachment and press **Send** yourself.

The side panel uses the in-memory store while the persistent case module is unavailable. Once Person 2's modules are present, run `npm run sync:case` again and reload the unpacked extension.
