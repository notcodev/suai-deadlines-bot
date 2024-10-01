import DOMParser from "node-html-parser";

export class InvalidSessionError extends Error {}

export async function getTasks(cookies) {
  const tasksPageResponse = await fetch(
    "https://pro.guap.ru/inside/student/tasks/?semester=24&subject=0&type=0&showStatus=0&text=&perPage=1000&sort=t.harddeadline&direction=asc&page=1",
    { headers: { Cookie: cookies }, redirect: "manual" },
  );

  if (tasksPageResponse.status !== 200) {
    throw new InvalidSessionError();
  }

  const tasksPageData = await tasksPageResponse.text();
  const htmlDocument = DOMParser.parse(tasksPageData);
  const tableRows = htmlDocument.querySelectorAll("table.table > tbody > tr");

  return tableRows.map((tableRow) => {
    const rowCells = tableRow.querySelectorAll("td");

    const disciplineCell = rowCells[1];
    const nameCell = rowCells[3];
    const deadlineCell = rowCells[7];

    const dateComponents = deadlineCell.textContent
      .trim()
      .match(/^(\d+).(\d+).(\d+)$/)
      ?.slice(1)
      ?.map(Number);

    return {
      discipline: {
        name: disciplineCell.textContent.trim(),
        url:
          "https://pro.guap.ru" +
          disciplineCell.querySelector("a").attributes.href,
      },
      name: nameCell.textContent.trim(),
      url: "https://pro.guap.ru" + nameCell.querySelector("a").attributes.href,
      deadlineTimestamp: dateComponents
        ? new Date(
            dateComponents[2],
            dateComponents[1] - 1,
            dateComponents[0],
            23,
            59,
          ).getTime()
        : null,
    };
  });
}
