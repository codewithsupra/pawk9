"use client";

import { startTransition } from "react";
import { flushSync } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import PetFormButton from "@/components/pet-form-button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PET_IMAGE } from "@/lib/constants";
import { usePetContext } from "@/lib/hooks";
import { petFormSchema, type PetFormData } from "@/lib/validations";

type PetFormProps = {
  actionType: "add" | "edit";
  onFormSubmission: () => void;
};

// The server actions take FormData, so rebuild it from the validated values.
function toFormData(values: PetFormData) {
  const formData = new FormData();
  formData.set("name", values.name);
  formData.set("ownerName", values.ownerName);
  if (values.ownerEmail) formData.set("ownerEmail", values.ownerEmail);
  if (values.ownerPhone) formData.set("ownerPhone", values.ownerPhone);
  formData.set("age", String(values.age));
  if (values.imageUrl) formData.set("imageUrl", values.imageUrl);
  if (values.notes) formData.set("notes", values.notes);
  return formData;
}

export default function PetForm({
  actionType,
  onFormSubmission,
}: PetFormProps) {
  const { addPet, editPet, selectedPet } = usePetContext();
  const petToEdit = actionType === "edit" ? selectedPet : undefined;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    // Same schema the server actions use, so both sides agree on what is valid.
    resolver: zodResolver(petFormSchema),
    defaultValues: {
      name: petToEdit?.name ?? "",
      ownerName: petToEdit?.ownerName ?? "",
      ownerEmail: petToEdit?.ownerEmail ?? "",
      ownerPhone: petToEdit?.ownerPhone ?? "",
      // The default image is applied by the schema, so leave the field empty for it.
      imageUrl:
        petToEdit && petToEdit.imageUrl !== DEFAULT_PET_IMAGE
          ? petToEdit.imageUrl
          : "",
      age: petToEdit?.age ?? "",
      notes: petToEdit?.notes ?? "",
    },
  });

  // Add and edit are optimistic: the change shows immediately and rolls back if the
  // server fails. The optimistic update must run inside a transition, and a
  // react-hook-form submit is a plain event handler, so start one here.
  // handleSubmit only calls this once the values pass validation.
  const onValid = (values: PetFormData) => {
    if (actionType === "edit" && !petToEdit) return;
    const formData = toFormData(values);

    startTransition(async () => {
      // State updates inside an async transition are held until it finishes, so force
      // the dialog closed now instead of waiting for the server.
      flushSync(onFormSubmission);

      if (actionType === "add") {
        await addPet(values, formData);
      } else if (petToEdit) {
        // Spread the existing pet first so its stays are kept. The optional fields are named
        // explicitly because zod leaves a cleared one out of `values` entirely, and a plain
        // spread would then keep the old value on screen until the server answered.
        await editPet(
          {
            ...petToEdit,
            ...values,
            notes: values.notes,
            ownerEmail: values.ownerEmail,
            ownerPhone: values.ownerPhone,
          },
          formData,
        );
      }
    });
  };

  return (
    // noValidate: let zod report errors instead of the browser's built-in bubbles.
    <form onSubmit={handleSubmit(onValid)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            type="text"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.ownerName}>
          <FieldLabel htmlFor="ownerName">Owner name</FieldLabel>
          <Input
            id="ownerName"
            type="text"
            aria-invalid={!!errors.ownerName}
            {...register("ownerName")}
          />
          <FieldError errors={[errors.ownerName]} />
        </Field>
        <Field data-invalid={!!errors.ownerEmail}>
          <FieldLabel htmlFor="ownerEmail">Owner email</FieldLabel>
          <Input
            id="ownerEmail"
            type="email"
            inputMode="email"
            autoComplete="off"
            aria-invalid={!!errors.ownerEmail}
            {...register("ownerEmail")}
          />
          <FieldError errors={[errors.ownerEmail]} />
        </Field>
        <Field data-invalid={!!errors.ownerPhone}>
          <FieldLabel htmlFor="ownerPhone">Owner phone</FieldLabel>
          <Input
            id="ownerPhone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            aria-invalid={!!errors.ownerPhone}
            {...register("ownerPhone")}
          />
          <FieldError errors={[errors.ownerPhone]} />
        </Field>
        <Field data-invalid={!!errors.imageUrl}>
          <FieldLabel htmlFor="imageUrl">Image URL</FieldLabel>
          <Input
            id="imageUrl"
            type="url"
            aria-invalid={!!errors.imageUrl}
            {...register("imageUrl")}
          />
          <FieldError errors={[errors.imageUrl]} />
        </Field>
        <Field data-invalid={!!errors.age}>
          <FieldLabel htmlFor="age">Age</FieldLabel>
          <Input
            id="age"
            type="number"
            min={0}
            step={1}
            aria-invalid={!!errors.age}
            {...register("age")}
          />
          <FieldError errors={[errors.age]} />
        </Field>
        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            rows={3}
            aria-invalid={!!errors.notes}
            {...register("notes")}
          />
          <FieldError errors={[errors.notes]} />
        </Field>
        <PetFormButton
          pendingText={actionType === "add" ? "Adding…" : "Saving…"}
        >
          {actionType === "add" ? "Add a new pet" : "Save changes"}
        </PetFormButton>
      </FieldGroup>
    </form>
  );
}
