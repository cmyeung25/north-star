import { postReset } from "./handler";

export async function POST(request: Request) {
  return postReset(request);
}
