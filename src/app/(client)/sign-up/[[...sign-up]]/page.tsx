import { COGNIS_BRAND } from "@/lib/cognis-brand";
import { SignUp } from "@clerk/nextjs";

function SignUpPage() {
  // Split the brand name so the second word picks up the accent colour the
  // way the upstream "FoloUp" wordmark did (e.g. "Cognis Hire" → "Cognis" + "Hire").
  const [head, ...rest] = COGNIS_BRAND.name.split(" ");
  const tail = rest.join(" ");

  return (
    <div className="flex items-center justify-center h-screen w-full bg-white absolute top-0 left-0 z-50">
      <div className="hidden md:block align-middle my-auto">
        <SignUp forceRedirectUrl="/dashboard" />
      </div>
      <div className="block md:hidden px-3 h-[60%] my-auto">
        <h1 className="text-2xl font-bold text-center text-gray-800">
          Welcome to {head}
          {tail ? <span className="text-indigo-600">{` ${tail}`}</span> : null}
        </h1>
        <h1 className="text-md my-3 text-center text-gray-800">
          {COGNIS_BRAND.name} works best on a desktop browser.
        </h1>
        <p className="text-center text-gray-600 mt-3">
          Sign up from a desktop to set up your first interview in a few minutes.
        </p>
      </div>
    </div>
  );
}
export default SignUpPage;
