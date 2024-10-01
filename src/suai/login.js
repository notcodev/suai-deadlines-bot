import DOMParser from "node-html-parser";

export class InvalidCredentialsError extends Error {}

function createCookiesStore() {
  const cookies = [];

  return {
    appendCookies: (setCookieHeaders) =>
      setCookieHeaders.forEach((cookie) => cookies.push(cookie.split(";")[0])),
    getCookies: () => cookies.join(";"),
  };
}

export async function login(credentials) {
  const cookiesStore = createCookiesStore();
  const response = await fetch("https://pro.guap.ru/oauth/login");

  cookiesStore.appendCookies(response.headers.getSetCookie());

  const data = await response.text();
  const htmlDocument = DOMParser.parse(data);
  const formElement = htmlDocument.querySelector("#kc-form-login");

  const submitUrl = formElement.attributes.action;
  const formData = new URLSearchParams([
    ["username", credentials.username],
    ["password", credentials.password],
    ["rememberMe", "on"],
    ["credentialId", ""],
  ]);

  const loginResponse = await fetch(submitUrl, {
    body: formData,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookiesStore.getCookies(),
      Host: "sso.guap.ru:8443",
      Origin: "null",
    },
    redirect: "manual",
  });

  if (loginResponse.status !== 302) {
    throw new InvalidCredentialsError();
  }

  cookiesStore.appendCookies(loginResponse.headers.getSetCookie());

  const redirectResponse = await fetch(loginResponse.headers.get("location"), {
    headers: { Cookie: cookiesStore.getCookies() },
    redirect: "manual",
  });

  cookiesStore.appendCookies(redirectResponse.headers.getSetCookie());

  return cookiesStore.getCookies();
}
