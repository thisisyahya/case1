const rooms = require("../models/rooms"); // Import the Rooms schema
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyAJ9Gb69tYaRXeK34oQl8Ze3OVwP5Th9WY");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


async function parseCrimeCase(responseText, roomId) {
  try {
    const [caseDetails, optionsPart] = responseText.split("&separated&");
    const [optionsText, correctAnswer] = optionsPart.split("&answer&");

    let crimeCase = caseDetails.trim();
    let options;
    console.log("raw options ->>>>>", optionsPart);
    
    // Ensure valid JSON parsing
    try {
      options = JSON.parse(optionsText.trim());
      console.log("optios are ->>>>",options);
    } catch (jsonError) {
      console.error("Invalid JSON format in options:", jsonError);
      return null; // Return null if JSON parsing fails
    }

    let answer = correctAnswer.trim().replace(/"/g, "");

    let crimeCaseUpdated = await rooms.findOneAndUpdate(
      { roomId: roomId },
      {
        $set: { case: crimeCase, answer: answer },
        $push: { options: { $each: options } }
      },
      { returnDocument: "after" } // Ensures the updated document is returned
    );

    console.log("Updated Crime Case:", crimeCaseUpdated);
    return crimeCaseUpdated;
  } catch (error) {
    console.error("Error in parseCrimeCase:", error);
    return null; // Return null in case of failure
  }
}



const generateCase = async (roomId, io) => {
  try {

    let hasCase = await rooms.findOne({ roomId: roomId }, { hasCase: 1, _id: 0 });
    let status = await rooms.findOne({ roomId: roomId }, { status: 1, _id: 0 });

    console.log("THE STATUS IS:", status);

    if (status?.status === true && hasCase?.hasCase === false) {

      let hasCase = await rooms.findOneAndUpdate(
                  { roomId: roomId }, // Filter to find the room
                  { $set: { hasCase: true } }, // Update operation
                  { new: true } // Returns the updated document
              );

      console.log(status, hasCase);

      const prompt =
        'Generate a unique crime case for a multiplayer deduction game involving mystery, murder, robbery, theft, or disappearance. Structure the output strictly using HTML tags without actual HTML formatting. Follow these rules:- Use <h1> for the case title.- Provide the case description inside <p>, clearly outlining the scenario.- Present suspect statements as <b>[Name]</b>: [Statement] inside <p>, ensuring some are misleading while others contain subtle clues. Do not reveal the final culprit.- After the case details, include seven or fewer possible solutions formatted as ["victim_name", "victim_name", ..., "victim_name"], only listing the victim name without additional details.- Separate the case details and options using the keyword &separated&.- Append the correct answer after the options using &answer&, stating only the "victim name" in double quotes.- Maintain a continuous format with no line spaces or additional explanations.';

      let result = await model.generateContent(prompt);
      let responseText = result.response.text(); // Extract AI-generated text

      responseText = '<h1>The Vanishing Composer</h1><p>Renowned pianist Victor Langford was found missing from his locked study on the night before his grand concert. His piano still played a single repeating note, held down by a weighted key. The only window was latched from the inside, and the door was locked. Inside, investigators found a tipped-over cup of tea, a scattered sheet of music with strange markings, and Victors glasses on the floor. His rival, a close friend, his assistant, and a mysterious benefactor all have conflicting accounts of the last time they saw him.</p><p><b>Arthur Bennett</b>: "Victor was anxious about the concert. He barely spoke when I visited him earlier in the evening. I left when he started playing an odd tune repeatedly."</p><p><b>Lena Hart</b>: "I prepared his tea like always, but he seemed distracted. He kept mentioning a secret note hidden in his music. I locked up and left after serving him."</p><p><b>Daniel Cross</b>: "Victor asked me to deliver a package, but when I returned, his study was silent. I knocked, but there was no response. Assuming he was resting, I left."</p><p><b>Margaret Doyle</b>: "Victor was worried about someone altering his music sheets. He had me check them an hour before he went to practice. I swear everything was normal."</p>&separated&["Victor Langford", "Arthur Bennett", "Lena Hart", "Daniel Cross", "Margaret Doyle"]&answer&"Victor Langford"';
     // console.log(responseText);
      let crimeCaseUpdated = await parseCrimeCase(responseText, roomId);
      
      //console.log(responseText);
      io.to(roomId).emit("case", { crimeCaseUpdated }); // Send only the text
    }
    else{
      console.log("room has already a case or it is not initialized");
    }
  } catch (error) {
    console.error("Error generating content:", error);
  }
};

// Export the function
module.exports = generateCase;