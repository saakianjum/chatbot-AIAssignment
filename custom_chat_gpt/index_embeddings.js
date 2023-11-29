// Run this server with cmd "node index_embeddings.js" from root directory.
// Ensure you have values for AIRTABLE_BASE_ID and AIRTABLE_API_KEY environment variables in .env.
// Airtable base name used in this example is "Frontend Fresh" and Airtable view is "Grid view".

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

require("dotenv").config();
const express = require("express");
const { Configuration, OpenAIApi } = require("openai");
const Airtable = require("airtable");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");

const pdf = require('pdf-parse');

// import express from "express";
// import { Configuration, OpenAIApi } from "openai";
// import Airtable from "airtable";
// import multer from "multer";
// import cors from "cors";
// import fs  from "fs";
// import PdfReader from 'pdfreader';


const app = express();
app.use(express.json());
app.use(cors())

// airtable configuration
const airtableBase = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);
const airtableTable = airtableBase(process.env.AIRTABLE_TABLE_NAME);
const airtableView = airtableTable.select({ view: process.env.AIRTABLE_VIEW_NAME });


// open ai configuration
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const port = process.env.PORT || 5000;

// constants
const COMPLETIONS_MODEL = "text-davinci-003";
const EMBEDDING_MODEL = "text-embedding-ada-002";//"text-embedding-ada-002";

// functions
// ---
function cosineSimilarity(A, B) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  return dotProduct / (normA * normB);
}

function getSimilarityScore(embeddingsHash, promptEmbedding) {
  const similarityScoreHash = {};
  Object.keys(embeddingsHash).forEach((text) => {
    similarityScoreHash[text] = cosineSimilarity(
      promptEmbedding,
      JSON.parse(embeddingsHash[text])
    );
  });
  return similarityScoreHash;
}

function getAirtableData() {
  return new Promise((resolve, reject) => {
    airtableView.firstPage((error, records) => {
      if (error) {
        console.log("Error-----"+error);
        return reject({});
      }
      const recordsHash = {};
      records.forEach(
        (record) => (recordsHash[record.get("Text")] = record.get("Embedding"))
      );
      resolve(recordsHash);
    });
  });
}
// ---

var upload = multer({ dest: "public/uploads/" });
app.post("/readFile",upload.single("file"), async (req, res) => {
  try {    
    if (req.file) {
      fs.readFile(req.file.path, (err, pdfBuffer) => {
        // console.log(pdfBuffer)
        pdf(pdfBuffer).then(async function(data) {
          //  console.log(data.text);
            let pdfContent = data.text.replaceAll('\n',' ') 
            const requestOptions = {
              method: "POST",
              headers: { "Content-Type": "application/json",
                          "Authorization":"Bearer "+process.env.OPENAI_API_KEY
                      },
              body: JSON.stringify({"input": pdfContent,"model":"text-embedding-ada-002"}),
            };
    
            let embedString;
            try{
              await fetch("https://api.openai.com/v1/embeddings", requestOptions).then(function (response) {
                return response.text().then(function (message) {
                  embedString='['+JSON.parse(message).data[0].embedding.toString()+']';
                })
              });
            // console.log(embedString)

              const bodyData={
                "records": [
                  {
                    "fields": {
                      "Text": pdfContent,
                      "Embedding": embedString
                    }
                  }
                ]
              }
              
              const requestOptionsForInsert = {
                method: "POST",
                headers: { "Content-Type": "application/json",
                            "Authorization":"Bearer "+process.env.AIRTABLE_API_KEY
                        },
                body: JSON.stringify(bodyData),
              };
          
              let url="https://api.airtable.com/v0/"+process.env.AIRTABLE_BASE_ID+"/"+process.env.AIRTABLE_TABLE_ID;
              const response = await fetch(url, requestOptionsForInsert)
          
              if (!response.ok) {
                console.log('Insertion failed')
              }
              console.log('Insertion done')
            }
            catch (err) {
              console.log("Error during insertion"+err)
            }
        });
      });
      res.send({
        status: true,
        message: "File Upload in progress",
      });
    } else {
      res.status(400).send({
        status: false,
        data: "File Not Found :(",
      });
    }
  } catch (err) {
    res.status(500).send(err);
  }
});
app.post("/load", async (req, res) => {
  const cleanReq = req.body.clearData;

  const requestOptionsForEmbeddings = {
    method: "POST",
    headers: { "Content-Type": "application/json",
                "Authorization":"Bearer "+process.env.OPENAI_API_KEY
            },
    body: JSON.stringify({"input": req.body.contetString,"model":"text-embedding-ada-002"}),
  };

  let embedString;
  await fetch("https://api.openai.com/v1/embeddings", requestOptionsForEmbeddings).then(function (response) {
    return response.text().then(function (message) {
      embedString='['+JSON.parse(message).data[0].embedding.toString()+']';
    })
  });
  try {
    const bodyData={
      "records": [
        {
          "fields": {
            "Text": req.body.contetString,
            "Embedding": embedString
          }
        }
      ]
    } 

    //Cleaning the data
    if(cleanReq){
        const requestOptions = {
          method: "GET",
          headers: { "Content-Type": "application/json",
                      "Authorization":"Bearer "+process.env.AIRTABLE_API_KEY
                  }
        };
    
        let url="https://api.airtable.com/v0/"+process.env.AIRTABLE_BASE_ID+"/"+process.env.AIRTABLE_TABLE_ID;
        let allRecords;
        const response = await fetch(url, requestOptions).then(function (response) {
          return response.text().then(function (message) {
            allRecords=JSON.parse(message).records;
          })
        });
        console.log(allRecords.length)
        let delRecString='';
        for(let ind=0;ind<allRecords.length;ind++){
          if(delRecString.length==0)
            delRecString='records='+allRecords[ind].id;
          else
            delRecString+='&records='+allRecords[ind].id;
        }

        const delRequestOptions = {
          method: "DELETE",
          headers: { "Content-Type": "application/json",
                      "Authorization":"Bearer "+process.env.AIRTABLE_API_KEY
                  }
        };
    
        let deleteUrl="https://api.airtable.com/v0/"+process.env.AIRTABLE_BASE_ID+"/"+process.env.AIRTABLE_TABLE_ID+'?'+delRecString;
        const delResponse = await fetch(deleteUrl, delRequestOptions)
        console.log(deleteUrl)
        if (!delResponse.ok) {
          console.log('Records deleted Succ')
        }
        else{
          console.log('Records deleted Failed')
        }
    }
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json",
                  "Authorization":"Bearer "+process.env.AIRTABLE_API_KEY
              },
      body: JSON.stringify(bodyData),
    };

    let url="https://api.airtable.com/v0/"+process.env.AIRTABLE_BASE_ID+"/"+process.env.AIRTABLE_TABLE_ID;
    const response = await fetch(url, requestOptions)

    if (!response.ok) {
      return res.status(200).json({
        success: true,
        message: "Insertion failed",
      });
    }
    return res.status(200).json({
      success: true,
      message: cleanReq?"Data cleaned & inserted":"Data Added to existing",
    });

  } catch (err) {
    console.log("Error Occrured during insertion:"+error.message);
    return res.status(200).json({
      success: true,
      message: "Insertion failed",
    });
  }
});


app.post("/ask", async (req, res) => {
  const prompt = req.body.prompt;

  try {
    if (prompt == null) {
      throw new Error("Uh oh, no prompt was provided");
    }

    // getting text and embeddings data from airtable
    const embeddingsHash = await getAirtableData();
    // get embeddings value for prompt question
    const promptEmbeddingsResponse = await openai.createEmbedding({
      model: EMBEDDING_MODEL,
      input: prompt,
      max_tokens: 64,
    });
    const promptEmbedding = promptEmbeddingsResponse.data.data[0].embedding;

    // create map of text against similarity score
    const similarityScoreHash = getSimilarityScore(
      embeddingsHash,
      promptEmbedding
    );

    // get text (i.e. key) from score map that has highest similarity score
    const textWithHighestScore = Object.keys(similarityScoreHash).reduce(
      (a, b) => (similarityScoreHash[a] > similarityScoreHash[b] ? a : b)
    );

    // build final prompt
    const finalPrompt = `
      Info: ${textWithHighestScore}
      Question: ${prompt}
      Answer:
    `;

    const response = await openai.createCompletion({
      model: COMPLETIONS_MODEL,
      prompt: finalPrompt,
      max_tokens: 64,
    });

    const completion = response.data.choices[0].text;

    return res.status(200).json({
      success: true,
      message: completion,
    });
  } catch (error) {
    console.log("Error Occrured:"+error.message);
  }
});

app.listen(port, () => console.log(`Server is running on port ${port}!!`));
