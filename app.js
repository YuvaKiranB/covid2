const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const startDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

startDB();

const authenticate = (request, response, next) => {
  let jwtToken;
  const { authorization } = request.headers;
  if (authorization !== undefined) {
    jwtToken = authorization.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserDetails = `select * FROM user WHERE username = "${username}";`;
  const userDetails = await db.get(getUserDetails);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordCorrect = await bcrypt.compare(password, userDetails.password);
    if (isPasswordCorrect) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

function getCamelCase1(state) {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
}

function getCamelCase2(district) {
  return {
    districtId: district.district_id,
    districtName: district.district_name,
    stateId: district.state_id,
    cases: district.cases,
    cured: district.cured,
    active: district.active,
    deaths: district.deaths,
  };
}

function getCamelCase3(state) {
  return {
    stateName: state.state_name,
  };
}

app.get("/states/", authenticate, async (request, response) => {
  const getStates = `
  SELECT *
  FROM state
  ORDER BY state_id`;
  const states = await db.all(getStates);
  response.send(
    states.map((state) => {
      return getCamelCase1(state);
    })
  );
});

app.get("/states/:stateId/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  const getState = `
  SELECT *
  FROM state
  WHERE state_id = ${stateId}`;
  const state = await db.get(getState);
  response.send(getCamelCase1(state));
});

app.post("/districts/", authenticate, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const writeDistrict = `
  INSERT INTO
  district(district_name, state_id, cases, cured, active, deaths)
  VALUES(
    "${districtName}",
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  );`;
  await db.run(writeDistrict);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const getDistrict = `
  SELECT *
  FROM district
  WHERE district_id = ${districtId}`;
  const district = await db.get(getDistrict);
  response.send(getCamelCase2(district));
});

app.delete(
  "/districts/:districtId/",
  authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
  DELETE
  FROM district
  WHERE district_id = ${districtId}`;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

app.put("/districts/:districtId", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrict = `
  UPDATE district
  SET
  district_name = "${districtName}",
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths}
  WHERE district_id = ${districtId};`;
  await db.run(updateDistrict);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  const getStats = `
  SELECT
  SUM(cases) AS cases,
  SUM(cured) AS cured,
  SUM(active) AS active,
  SUM(deaths) AS deaths
  FROM district
  WHERE state_id = ${stateId}`;
  const stats = await db.get(getStats);
  response.send({
    totalCases: stats.cases,
    totalCured: stats.cured,
    totalActive: stats.active,
    totalDeaths: stats.deaths,
  });
});

app.get(
  "/districts/:districtId/details/",
  authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const getState = `
  SELECT DISTINCT state_name
  FROM (district INNER JOIN state ON state.state_id = district.state_id)
  WHERE district.district_id = ${districtId}`;
    const state = await db.get(getState);
    response.send(getCamelCase3(state));
  }
);
