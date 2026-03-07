import { postBootstrap } from "./handler";

export async function POST(request: Request) {
  return postBootstrap(request);
}
