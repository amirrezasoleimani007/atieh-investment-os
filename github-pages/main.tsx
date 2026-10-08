import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import "@/app/visual-standards.css";
import "@/app/capital-story.css";
import "@/app/decision-density.css";
import InvestmentOS from "@/components/investment-os";
import AccessGate from "@/components/access-gate";
import companies from "@/public/data/companies.json";
import financialCompanies from "@/public/data/financial-companies.json";
import portfolio from "@/public/data/portfolio.json";
import sectors from "@/public/data/sectors.json";
import opportunities from "@/public/data/opportunities.json";
import opportunityRelatedness from "@/public/data/opportunity-relatedness.json";
import isic from "@/public/data/isic.json";
import manifest from "@/public/data/manifest.json";
import movementMaster from "@/public/data/movement-master-data.json";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AccessGate>
      <InvestmentOS
        companies={companies}
        financialCompanies={financialCompanies}
        portfolio={portfolio}
        sectors={sectors}
        opportunities={opportunities}
        opportunityRelatedness={opportunityRelatedness}
        isic={isic}
        movementMaster={movementMaster}
        manifest={manifest}
      />
    </AccessGate>
  </StrictMode>,
);
