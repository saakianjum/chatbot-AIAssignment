import { useState, useEffect } from "react";
import "./App.css";
import lens from "./assets/lens.png";
import loadingGif from "./assets/loading.gif";
import axios from "axios";

function App() {
  const [prompt, updatePrompt] = useState(undefined);
  const [contentInput,setContentInput] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [cleanImport, setCleanImport] = useState(false);
  const [dataSaving, setDataSaving] = useState(false);
  const [answer, setAnswer] = useState(undefined);
  const [embededData, setEmbededData]= useState(undefined);
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (prompt != null && prompt.trim() === "") {
      setAnswer(undefined);
    }
  }, [prompt]);
  const saveData = async (event) => {
    if (event.key !== "Enter") {
      return;
    }

    try {
      setDataSaving(true);

      // const requestOptions = {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json",
      //               "Authorization":"Bearer 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"
      //           },
      //   body: JSON.stringify({"input": contentInput,"model":"text-embedding-ada-002"}),
      // };

      // let embedString;
      // await fetch("https://api.openai.com/v1/embeddings", requestOptions).then(function (response) {
      //   return response.text().then(function (message) {
      //     embedString='['+JSON.parse(message).data[0].embedding.toString()+']';
      //   })
      // });

      const requestOptionsForInsert = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
                    clearData:cleanImport,
                    contetString:contentInput,
                    // embeddingString:embedString
                   }),
      };
      // console.log(embedString)
      const res = await fetch("/api/load", requestOptionsForInsert);

      if (!res.ok) {
        throw new Error("Something went wrong");
      }

      const { message } = await res.json();
      setEmbededData(message);


    } catch (err) {
      console.error(err, "err");
      setEmbededData("Insertion failed");
    } finally {
      setDataSaving(false);
    }
  }
  const sendPrompt = async (event) => {
    if (event.key !== "Enter") {
      return;
    }

    try {
      setLoading(true);

      const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      };

      const res = await fetch("/api/ask", requestOptions);

      if (!res.ok) {
        throw new Error("Something went wrong");
      }

      const { message } = await res.json();
      setAnswer(message);
    } catch (err) {
      console.error(err, "err");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async(e) => {

    try {
      setLoading(true);
      let inputFile;
      if (e.target.files) {
        inputFile = e.target.files[0];
        setFile(e.target.files[0]);
      }
      const fileData = new FormData();
      fileData.append("file", inputFile);
      axios({
        method: "POST",
        url: "/api/readFile",
        data: fileData,
      }).then((res) => {       
          alert(res.data.message);
      });
      setContentInput(message);
    } catch (err) {
      console.error(err, "err");
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className="app">
      <div className="app-container">
        <div className="spotlight__wrapper">
          Upload File : <input type="file" onChange={handleFileChange}/> 
          <br></br>
          <div>
            ----------------------------------------OR-------------------------------------
          </div>
          <input
            type="text"
            className="spotlight__input"
            placeholder="Add content"
            disabled={loading}
            style={{
              backgroundImage: dataSaving ? `url(${loadingGif})` : `url(${lens})`,
            }}
            onChange={(e) => setContentInput(e.target.value)}
            onKeyDown={(e) => saveData(e)}
          />
          <input id="inputFile" type="checkbox" onChange={(e) => setCleanImport(!cleanImport)}/> Clean import

          <div className="spotlight__answer">{embededData && <p>{embededData}</p>}</div>
        </div>
        <div className="spotlight__wrapper">
          <input
            type="text"
            className="spotlight__input"
            placeholder="Ask me anything..."
            disabled={loading}
            style={{
              backgroundImage: loading ? `url(${loadingGif})` : `url(${lens})`,
            }}
            onChange={(e) => updatePrompt(e.target.value)}
            onKeyDown={(e) => sendPrompt(e)}
          />
          <div className="spotlight__answer">{answer && <p>{answer}</p>}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
