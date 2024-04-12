import {getList} from "@/helper/get.list";
import Main from "@/components/main";

export default async function Home() {
  const list = await getList();
  return (
     <Main list={list} />
  )
}