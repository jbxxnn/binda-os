"use client";

import { useActionState } from "react";
import {
  AuthField,
  AuthNotice,
  authInputClassName,
  authPrimaryButtonClassName,
  AuthShell,
} from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { createBusinessAction, type CreateBusinessState } from "@/app/setup/business/actions";

const initialState: CreateBusinessState = {
  error: null,
};

const businessTypes = ["Salon", "Barbershop", "Spa", "Nail Studio", "Beauty Studio"];

const countries = [
  {
    label: "Nigeria",
    value: "Nigeria",
  },
];

const currencies = [
  {
    label: "Nigerian Naira — ₦",
    value: "NGN",
  },
];

export function CreateBusinessForm() {
  const [state, formAction, isPending] = useActionState(
    createBusinessAction,
    initialState,
  );

  return (
    <AuthShell
      badge="Business Setup"
      title="Tell us about your business"
      description="Create the business profile to continue."
    >
      <form action={formAction} className="space-y-5">
        <AuthField htmlFor="business-name" label="Business name">
          <input
            id="business-name"
            name="businessName"
            required
            placeholder="Hairven Unisex Salon"
            className={authInputClassName}
          />
        </AuthField>

        <AuthField htmlFor="business-type" label="Business type">
          <select
            id="business-type"
            name="businessType"
            required
            defaultValue="Salon"
            className={authInputClassName}
          >
            {businessTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </AuthField>

        <AuthField htmlFor="country" label="Country">
          <select
            id="country"
            name="country"
            required
            defaultValue="Nigeria"
            className={authInputClassName}
          >
            {countries.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </select>
        </AuthField>

        <AuthField htmlFor="currency" label="Currency">
          <select
            id="currency"
            name="currency"
            required
            defaultValue="NGN"
            className={authInputClassName}
          >
            {currencies.map((currency) => (
              <option key={currency.value} value={currency.value}>
                {currency.label}
              </option>
            ))}
          </select>
        </AuthField>

        {state.error ? <AuthNotice tone="error">{state.error}</AuthNotice> : null}

        <Button
          type="submit"
          disabled={isPending}
          className={authPrimaryButtonClassName}
        >
          {isPending ? "Creating business..." : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );
}
